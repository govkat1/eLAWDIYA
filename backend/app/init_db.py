from app.database import engine
from app.models import models


def init_db():
    """Create database tables."""
    models.Base.metadata.create_all(bind=engine)


if __name__ == '__main__':
    init_db()
    print('Database tables created (if not existing).')
