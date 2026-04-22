import logging

import pytest

from app.modules.discovery.mapper import map_discovery_payload, map_restaurant_entry
from app.shared.errors import UpstreamUnavailableError


def _valid_entry(**overrides):
    entry = {
        "id": "12345",
        "name": "Mario's",
        "cuisines": [{"name": "Italian"}, {"name": "Pizza"}],
        "rating": {"starRating": 4.7},
        "address": {
            "firstLine": "123 High Street",
            "city": "London",
            "location": {"coordinates": [-0.1, 51.5]},
        },
        "minimumDeliveryValue": 12.0,
        "deliveryEtaMinutes": {"approximate": 25},
        "isOpenNowForDelivery": True,
    }
    entry.update(overrides)
    return entry


def test_map_restaurant_entry_maps_required_fields() -> None:
    mapped = map_restaurant_entry(_valid_entry())

    assert mapped is not None
    assert mapped.external_restaurant_id == "12345"
    assert mapped.name == "Mario's"
    assert mapped.cuisines == ["Italian", "Pizza"]
    assert mapped.rating == 4.7
    assert mapped.address_text == "123 High Street, London"
    assert mapped.latitude == 51.5
    assert mapped.longitude == -0.1
    assert mapped.minimum_order_pence == 1200
    assert mapped.delivery_eta_minutes == 25
    assert mapped.open_now is True


def test_map_restaurant_entry_sets_optional_missing_fields_to_none() -> None:
    mapped = map_restaurant_entry(
        _valid_entry(
            address={"firstLine": "123 High Street", "city": "London"},
            minimumDeliveryValue=None,
            deliveryEtaMinutes=None,
            isOpenNowForDelivery=None,
        )
    )

    assert mapped is not None
    assert mapped.latitude is None
    assert mapped.longitude is None
    assert mapped.minimum_order_pence is None
    assert mapped.delivery_eta_minutes is None
    assert mapped.open_now is None


def test_map_restaurant_entry_drops_malformed_entry_and_logs(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING):
        mapped = map_restaurant_entry(_valid_entry(name=None))

    assert mapped is None
    assert "Dropping malformed upstream restaurant entry" in caplog.text


def test_map_restaurant_entry_drops_entry_with_empty_usable_cuisines(
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.WARNING):
        mapped = map_restaurant_entry(_valid_entry(cuisines=[]))

    assert mapped is None
    assert "Dropping malformed upstream restaurant entry" in caplog.text


def test_map_discovery_payload_raises_for_globally_unusable_payload() -> None:
    with pytest.raises(UpstreamUnavailableError):
        map_discovery_payload({"metaData": {}})
