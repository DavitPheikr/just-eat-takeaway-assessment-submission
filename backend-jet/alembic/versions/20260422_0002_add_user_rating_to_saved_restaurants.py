"""add user rating to saved restaurants

Revision ID: 20260422_0002
Revises: 20260422_0001
Create Date: 2026-04-22 20:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260422_0002"
down_revision = "20260422_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "saved_restaurants",
        sa.Column("user_rating", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("saved_restaurants", "user_rating")
