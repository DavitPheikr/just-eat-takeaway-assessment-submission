from __future__ import annotations

import logging
from typing import Any

from app.modules.discovery.schemas import DiscoveryRestaurantMapped
from app.shared.errors import UpstreamUnavailableError

logger = logging.getLogger(__name__)

REQUIRED_RESTAURANT_FIELDS = (
    ("id", lambda entry: _as_non_blank_string(entry.get("id"))),
    ("name", lambda entry: _as_non_blank_string(entry.get("name"))),
    ("cuisines", lambda entry: _extract_cuisines(entry.get("cuisines"))),
    ("rating", lambda entry: _extract_rating(entry.get("rating"))),
    ("address", lambda entry: _extract_address_text(entry.get("address"))),
)


def map_discovery_payload(payload: dict[str, Any]) -> list[DiscoveryRestaurantMapped]:
    restaurants = payload.get("restaurants")
    if not isinstance(restaurants, list):
        raise UpstreamUnavailableError()

    mapped_restaurants: list[DiscoveryRestaurantMapped] = []
    for entry in restaurants:
        mapped_restaurant = map_restaurant_entry(entry)
        if mapped_restaurant is not None:
            mapped_restaurants.append(mapped_restaurant)

    return mapped_restaurants


def map_restaurant_entry(entry: Any) -> DiscoveryRestaurantMapped | None:
    if not isinstance(entry, dict):
        logger.warning("Dropping malformed upstream restaurant entry: not an object.")
        return None

    extracted_fields = {
        field_name: extractor(entry)
        for field_name, extractor in REQUIRED_RESTAURANT_FIELDS
    }
    missing_fields = [
        field_name
        for field_name, extracted_value in extracted_fields.items()
        if extracted_value is None
    ]

    if missing_fields:
        logger.warning(
            "Dropping malformed upstream restaurant entry %s due to missing required fields: %s",
            entry.get("id", "<unknown>"),
            ", ".join(missing_fields),
        )
        return None

    latitude, longitude = _extract_coordinates(entry.get("address"))

    return DiscoveryRestaurantMapped(
        external_restaurant_id=extracted_fields["id"],
        name=extracted_fields["name"],
        cuisines=extracted_fields["cuisines"],
        rating=extracted_fields["rating"],
        address_text=extracted_fields["address"],
        latitude=latitude,
        longitude=longitude,
        minimum_order_pence=_extract_minimum_order_pence(
            entry.get("minimumDeliveryValue")
        ),
        delivery_eta_minutes=_extract_delivery_eta_minutes(entry),
        open_now=_extract_open_now(entry),
        raw_payload=entry,
    )


def _as_non_blank_string(value: Any) -> str | None:
    if isinstance(value, str):
        normalized = value.strip()
        if normalized:
            return normalized
    elif value is not None:
        normalized = str(value).strip()
        if normalized:
            return normalized
    return None


def _extract_cuisines(value: Any) -> list[str] | None:
    if not isinstance(value, list):
        return None

    cuisines: list[str] = []
    for cuisine in value:
        if isinstance(cuisine, str):
            cuisine_name = cuisine.strip()
        elif isinstance(cuisine, dict):
            cuisine_name = _as_non_blank_string(cuisine.get("name")) or ""
        else:
            cuisine_name = ""

        if cuisine_name:
            cuisines.append(cuisine_name)

    return cuisines or None


def _extract_rating(value: Any) -> float | None:
    if isinstance(value, dict):
        value = value.get("starRating")

    if isinstance(value, (int, float)):
        return float(value)
    return None


def _extract_address_text(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None

    parts = []
    for key in ("firstLine", "city"):
        part = _as_non_blank_string(value.get(key))
        if part:
            parts.append(part)

    if not parts:
        return None

    return ", ".join(parts)


def _extract_coordinates(address: Any) -> tuple[float | None, float | None]:
    if not isinstance(address, dict):
        return (None, None)

    location = address.get("location")
    if not isinstance(location, dict):
        return (None, None)

    coordinates = location.get("coordinates")
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return (None, None)

    longitude = _to_float(coordinates[0])
    latitude = _to_float(coordinates[1])
    return (latitude, longitude)


def _extract_minimum_order_pence(value: Any) -> int | None:
    numeric_value = _to_float(value)
    if numeric_value is None:
        return None
    return int(round(numeric_value * 100))


def _extract_delivery_eta_minutes(entry: dict[str, Any]) -> int | None:
    delivery_eta = entry.get("deliveryEtaMinutes")
    approximate = None
    if isinstance(delivery_eta, dict):
        approximate = delivery_eta.get("approximate")
    elif isinstance(delivery_eta, (int, float)):
        approximate = delivery_eta

    if approximate is None:
        availability = entry.get("availability")
        if isinstance(availability, dict):
            delivery = availability.get("delivery")
            if isinstance(delivery, dict):
                eta_minutes = delivery.get("etaMinutes")
                if isinstance(eta_minutes, dict):
                    approximate = eta_minutes.get("approximate")

    numeric_value = _to_float(approximate)
    if numeric_value is None:
        return None
    return int(round(numeric_value))


def _extract_open_now(entry: dict[str, Any]) -> bool | None:
    value = entry.get("isOpenNowForDelivery")
    if isinstance(value, bool):
        return value

    availability = entry.get("availability")
    if isinstance(availability, dict):
        delivery = availability.get("delivery")
        if isinstance(delivery, dict):
            delivery_open = delivery.get("isOpen")
            if isinstance(delivery_open, bool):
                return delivery_open

    return None


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None
