from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.modules.discovery.schemas import PersistedRestaurantRecord
from app.modules.saved.service import SavedService
from app.shared.errors import (
    InvalidSavedRestaurantError,
    RatingRequiresVisitedError,
    SavedItemNotFoundError,
)


@dataclass
class SavedRecord:
    id: UUID
    user_id: str
    restaurant_id: UUID
    saved_from_postcode: str
    saved_at: datetime
    visited: bool
    visited_at: datetime | None
    review_text: str | None
    user_rating: int | None
    snapshot_payload: dict


class FakeRestaurantRepository:
    def __init__(self, records: list[PersistedRestaurantRecord]) -> None:
        self.records = {record.id: record for record in records}

    async def get_by_id(self, restaurant_id: UUID) -> PersistedRestaurantRecord | None:
        return self.records.get(restaurant_id)


class FakeSavedRestaurantRepository:
    def __init__(self) -> None:
        self.records: list[SavedRecord] = []

    async def list_for_user(
        self,
        user_id: str,
        *,
        saved_from_postcode: str | None = None,
        visited: bool | None = None,
        has_user_rating: bool | None = None,
        has_review_text: bool | None = None,
    ):
        results = [record for record in self.records if record.user_id == user_id]
        if saved_from_postcode is not None:
            results = [r for r in results if r.saved_from_postcode == saved_from_postcode]
        if visited is not None:
            results = [r for r in results if r.visited is visited]
        if has_user_rating is True:
            results = [r for r in results if r.visited and r.user_rating is not None]
        elif has_user_rating is False:
            results = [r for r in results if not (r.visited and r.user_rating is not None)]
        if has_review_text is True:
            results = [r for r in results if r.visited and r.review_text is not None]
        elif has_review_text is False:
            results = [r for r in results if not (r.visited and r.review_text is not None)]
        return sorted(results, key=lambda record: record.saved_at, reverse=True)

    async def get_by_id(self, saved_id: UUID, user_id: str):
        for record in self.records:
            if record.id == saved_id and record.user_id == user_id:
                return record
        return None

    async def get_by_user_and_restaurant(self, user_id: str, restaurant_id: UUID):
        for record in self.records:
            if record.user_id == user_id and record.restaurant_id == restaurant_id:
                return record
        return None

    async def create(self, **kwargs):
        record = SavedRecord(id=uuid4(), **kwargs)
        self.records.append(record)
        return record

    async def save(self, record):
        return record

    async def delete(self, record):
        self.records = [stored for stored in self.records if stored.id != record.id]


def _restaurant(*, restaurant_id: UUID | None = None, name: str = "Mario's") -> PersistedRestaurantRecord:
    return PersistedRestaurantRecord(
        id=restaurant_id or uuid4(),
        external_restaurant_id="jet-123",
        name=name,
        cuisines=["Italian", "Pizza"],
        rating=4.7,
        address_text="123 High Street, London",
        latitude=51.5,
        longitude=-0.1,
        minimum_order_pence=1200,
        delivery_eta_minutes=25,
        open_now=True,
        raw_payload={"id": "jet-123", "name": name},
        last_seen_at=datetime.now(UTC),
    )


@pytest.mark.anyio
async def test_saved_service_save_creates_entry() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    response = await service.save_restaurant(restaurant.id, "EC4M7RF")

    assert response.item.restaurantId == restaurant.id
    assert response.item.savedFromPostcode == "EC4M7RF"
    assert response.item.visited is False
    assert response.item.userRating is None
    assert len(saved_repository.records) == 1
    assert saved_repository.records[0].snapshot_payload["name"] == "Mario's"


@pytest.mark.anyio
async def test_saved_service_duplicate_save_is_idempotent() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    first = await service.save_restaurant(restaurant.id, "EC4M7RF")
    second = await service.save_restaurant(restaurant.id, "SW1A1AA")

    assert first.item.id == second.item.id
    assert second.item.savedFromPostcode == "EC4M7RF"
    assert len(saved_repository.records) == 1


@pytest.mark.anyio
async def test_saved_service_list_returns_newest_first_and_preserves_snapshot() -> None:
    first_restaurant = _restaurant(name="Mario's")
    second_restaurant = _restaurant(name="Pippo Pizza")
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([first_restaurant, second_restaurant])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await service.save_restaurant(first_restaurant.id, "EC4M7RF")
    saved_repository.records[0].saved_at = datetime(2026, 4, 20, tzinfo=UTC)
    await service.save_restaurant(second_restaurant.id, "N1C4AB")
    restaurant_repository.records[first_restaurant.id] = _restaurant(
        restaurant_id=first_restaurant.id,
        name="Mario's Updated",
    )

    response = await service.list_saved()

    assert [item.name for item in response.items] == ["Pippo Pizza", "Mario's"]
    assert response.items[1].addressText == "123 High Street, London"


@pytest.mark.anyio
async def test_saved_service_visited_toggle_updates_timestamps() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    first_update = await service.update_saved(created.item.id, visited=True)
    second_update = await service.update_saved(created.item.id, visited=True)
    cleared = await service.update_saved(created.item.id, visited=False)

    assert first_update.visited is True
    assert first_update.visitedAt is not None
    assert second_update.visitedAt == first_update.visitedAt
    assert cleared.visited is False
    assert cleared.visitedAt is None


@pytest.mark.anyio
async def test_saved_service_review_text_persists_and_can_be_nulled() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    updated = await service.update_saved(created.item.id, review_text="Great pizza.")
    cleared = await service.update_saved(created.item.id, review_text=None)

    assert updated.reviewText == "Great pizza."
    assert cleared.reviewText is None


@pytest.mark.anyio
async def test_saved_service_user_rating_persists_and_can_be_overwritten_or_cleared() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    await service.update_saved(created.item.id, visited=True)
    rated = await service.update_saved(created.item.id, user_rating=4)
    rerated = await service.update_saved(created.item.id, user_rating=2)
    cleared = await service.update_saved(created.item.id, user_rating=None)

    assert rated.userRating == 4
    assert rerated.userRating == 2
    assert cleared.userRating is None


async def _seed_saved(
    service: SavedService,
    repo: FakeSavedRestaurantRepository,
    restaurant_repo: FakeRestaurantRepository,
    *,
    postcode: str,
    visited: bool = False,
    user_rating: int | None = None,
    review_text: str | None = None,
) -> UUID:
    restaurant = _restaurant()
    restaurant_repo.records[restaurant.id] = restaurant
    created = await service.save_restaurant(restaurant.id, postcode)
    record = next(r for r in repo.records if r.id == created.item.id)
    if visited:
        record.visited = True
        record.visited_at = datetime.now(UTC)
    record.user_rating = user_rating
    record.review_text = review_text
    return created.item.id


@pytest.mark.anyio
async def test_saved_service_filter_by_postcode_matches_exact() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(service, saved_repository, restaurant_repository, postcode="EC4M7RF")
    await _seed_saved(service, saved_repository, restaurant_repository, postcode="N1C4AB")

    response = await service.list_saved(saved_from_postcode="EC4M7RF")

    assert [item.savedFromPostcode for item in response.items] == ["EC4M7RF"]


@pytest.mark.anyio
async def test_saved_service_filter_by_postcode_normalizes_input() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(service, saved_repository, restaurant_repository, postcode="EC4M7RF")

    response = await service.list_saved(saved_from_postcode=" ec4m 7rf ")

    assert len(response.items) == 1


@pytest.mark.anyio
async def test_saved_service_filter_by_visited() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(service, saved_repository, restaurant_repository, postcode="EC4M7RF", visited=True)
    await _seed_saved(service, saved_repository, restaurant_repository, postcode="N1C4AB", visited=False)

    only_visited = await service.list_saved(visited=True)
    only_unvisited = await service.list_saved(visited=False)

    assert [item.savedFromPostcode for item in only_visited.items] == ["EC4M7RF"]
    assert [item.savedFromPostcode for item in only_unvisited.items] == ["N1C4AB"]


@pytest.mark.anyio
async def test_saved_service_has_user_rating_true_excludes_unvisited_with_latent_rating() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="EC4M7RF", visited=True, user_rating=4,
    )
    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="N1C4AB", visited=False, user_rating=5,
    )
    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="SW1A1AA", visited=True, user_rating=None,
    )

    rated = await service.list_saved(has_user_rating=True)

    assert [item.savedFromPostcode for item in rated.items] == ["EC4M7RF"]


@pytest.mark.anyio
async def test_saved_service_has_user_rating_false_includes_unvisited_with_latent_rating() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="EC4M7RF", visited=True, user_rating=4,
    )
    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="N1C4AB", visited=False, user_rating=5,
    )

    unrated = await service.list_saved(has_user_rating=False)

    assert [item.savedFromPostcode for item in unrated.items] == ["N1C4AB"]


@pytest.mark.anyio
async def test_saved_service_has_review_text_true_excludes_unvisited_with_latent_review() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="EC4M7RF", visited=True, review_text="Great pizza",
    )
    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="N1C4AB", visited=False, review_text="Forgot to mark visited",
    )

    reviewed = await service.list_saved(has_review_text=True)

    assert [item.savedFromPostcode for item in reviewed.items] == ["EC4M7RF"]


@pytest.mark.anyio
async def test_saved_service_filters_combine() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="EC4M7RF", visited=True, user_rating=4,
    )
    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="EC4M7RF", visited=False, user_rating=5,
    )
    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="N1C4AB", visited=True, user_rating=3,
    )

    response = await service.list_saved(
        saved_from_postcode="EC4M7RF",
        visited=True,
        has_user_rating=True,
    )

    assert [item.userRating for item in response.items] == [4]


@pytest.mark.anyio
async def test_saved_service_contradictory_filters_return_empty() -> None:
    saved_repository = FakeSavedRestaurantRepository()
    restaurant_repository = FakeRestaurantRepository([])
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=restaurant_repository,
    )

    await _seed_saved(
        service, saved_repository, restaurant_repository,
        postcode="EC4M7RF", visited=True, user_rating=4,
    )

    response = await service.list_saved(visited=False, has_user_rating=True)

    assert response.items == []


@pytest.mark.anyio
async def test_saved_service_rating_requires_visited_is_rejected_when_not_visited() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")

    with pytest.raises(RatingRequiresVisitedError):
        await service.update_saved(created.item.id, user_rating=4)

    assert saved_repository.records[0].user_rating is None


@pytest.mark.anyio
async def test_saved_service_rating_with_visited_in_same_patch_is_accepted() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    updated = await service.update_saved(created.item.id, visited=True, user_rating=5)

    assert updated.visited is True
    assert updated.userRating == 5


@pytest.mark.anyio
async def test_saved_service_rating_is_preserved_across_visited_toggle() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    await service.update_saved(created.item.id, visited=True, user_rating=3)
    unvisited = await service.update_saved(created.item.id, visited=False)
    revisited = await service.update_saved(created.item.id, visited=True)

    assert unvisited.visited is False
    assert unvisited.userRating == 3
    assert revisited.visited is True
    assert revisited.userRating == 3


@pytest.mark.anyio
async def test_saved_service_clearing_rating_is_allowed_when_not_visited() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    await service.update_saved(created.item.id, visited=True, user_rating=4)
    await service.update_saved(created.item.id, visited=False)
    cleared = await service.update_saved(created.item.id, user_rating=None)

    assert cleared.visited is False
    assert cleared.userRating is None


@pytest.mark.anyio
async def test_saved_service_delete_removes_entry() -> None:
    restaurant = _restaurant()
    saved_repository = FakeSavedRestaurantRepository()
    service = SavedService(
        saved_restaurant_repository=saved_repository,
        restaurant_repository=FakeRestaurantRepository([restaurant]),
    )

    created = await service.save_restaurant(restaurant.id, "EC4M7RF")
    response = await service.delete_saved(created.item.id)

    assert response.deleted is True
    assert saved_repository.records == []


@pytest.mark.anyio
async def test_saved_service_missing_restaurant_raises_400_error() -> None:
    service = SavedService(
        saved_restaurant_repository=FakeSavedRestaurantRepository(),
        restaurant_repository=FakeRestaurantRepository([]),
    )

    with pytest.raises(InvalidSavedRestaurantError):
        await service.save_restaurant(uuid4(), "EC4M7RF")


@pytest.mark.anyio
async def test_saved_service_unknown_saved_id_raises_not_found() -> None:
    service = SavedService(
        saved_restaurant_repository=FakeSavedRestaurantRepository(),
        restaurant_repository=FakeRestaurantRepository([]),
    )

    with pytest.raises(SavedItemNotFoundError):
        await service.update_saved(uuid4(), visited=True)

    with pytest.raises(SavedItemNotFoundError):
        await service.delete_saved(uuid4())
