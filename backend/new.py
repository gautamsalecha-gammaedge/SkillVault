# # delete_all_workers.py

# from db import SessionLocal
# from models import Worker, WorkerSession, WorkerMachine

# db = SessionLocal()

# try:
#     # Delete in correct order (sessions & machines first because of foreign keys)
#     deleted_sessions = db.query(WorkerSession).delete()
#     deleted_machines = db.query(WorkerMachine).delete()
#     deleted_workers = db.query(Worker).delete()
    
#     db.commit()
    
#     print(f"Deleted:")
#     print(f"  - {deleted_sessions} worker sessions")
#     print(f"  - {deleted_machines} worker-machine assignments")
#     print(f"  - {deleted_workers} workers")
#     print("All workers have been removed.")
# except Exception as e:
#     db.rollback()
#     print("Error:", e)
# finally:
#     db.close()