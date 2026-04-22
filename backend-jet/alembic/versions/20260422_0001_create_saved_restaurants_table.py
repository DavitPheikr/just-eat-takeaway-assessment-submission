"""create saved restaurants table

Revision ID: 20260422_0001
Revises: 20260421_0500
Create Date: 2026-04-22 20:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260422_0001"
down_revision = "20260421_0500"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_restaurants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("saved_from_postcode", sa.Text(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("visited", sa.Boolean(), nullable=False),
        sa.Column("visited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_text", sa.Text(), nullable=True),
        sa.Column("snapshot_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["restaurant_id"], ["restaurants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "restaurant_id"),
    )
    op.execute(
        sa.text(
            "CREATE INDEX ix_saved_restaurants_user_id_saved_at "
            "ON saved_restaurants (user_id, saved_at DESC)"
        )
    )


def downgrade() -> None:
    op.drop_index("ix_saved_restaurants_user_id_saved_at", table_name="saved_restaurants")
    op.drop_table("saved_restaurants")
