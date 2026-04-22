from __future__ import annotations


class AppError(Exception):
    """Base application error for shaped HTTP responses."""

    status_code = 500
    error_code = "INTERNAL_ERROR"
    message = "Internal server error."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        self.public_message = message or self.message

    def to_response(self) -> dict[str, dict[str, str]]:
        return {
            "error": {
                "code": self.error_code,
                "message": self.public_message,
            }
        }


class InvalidPostcodeError(AppError):
    status_code = 400
    error_code = "INVALID_POSTCODE"
    message = "Postcode could not be validated by upstream."


class UpstreamUnavailableError(AppError):
    status_code = 502
    error_code = "UPSTREAM_UNAVAILABLE"
    message = "Upstream restaurant service is unavailable."


class DiscoveryDependencyError(AppError):
    status_code = 500
    error_code = "INTERNAL_ERROR"
    message = "Internal server error."


class InvalidSavedRestaurantError(AppError):
    status_code = 400
    error_code = "INVALID_REQUEST"
    message = "Restaurant could not be saved because it does not exist."


class SavedItemNotFoundError(AppError):
    status_code = 404
    error_code = "NOT_FOUND"
    message = "Saved item not found."


class RatingRequiresVisitedError(AppError):
    status_code = 409
    error_code = "RATING_REQUIRES_VISITED"
    message = "A saved restaurant can only be rated once it has been marked as visited."


class InternalAppError(AppError):
    status_code = 500
    error_code = "INTERNAL_ERROR"
    message = "Internal server error."
