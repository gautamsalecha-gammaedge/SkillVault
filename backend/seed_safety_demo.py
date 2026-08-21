"""
seed_safety_demo.py

One-off script to seed short, testable Machine Safety Measures for three
demo machines: CNC-204, GR-150, LATHE-01.

Run from the backend/ directory, with your normal .env in place
(same DATABASE_URL your app already uses):

    python seed_safety_demo.py

Safe to re-run — it clears any existing measures for these three
machine_ids first, then inserts a fresh ordered set, so you won't end
up with duplicates if you run it twice.

NOTE on machine IDs: "CNC-204" and "GR-150" match the style already
used elsewhere in this repo (e.g. backend/CNC-204_manual.pdf). For
"lathe machine" I used the id LATHE-01 — if your app already has a
different exact machine_id string for the lathe (from an uploaded
manual or a worker assignment), rename LATHE_ID below to match it
exactly, since the whole app keys everything off that exact string.
"""

import uuid
from datetime import datetime

from db import SessionLocal, engine, Base
from models import SafetyMeasure  # noqa: F401 (ensures table is registered on Base)

# Make sure the safety_measures / safety_completions tables exist.
# Harmless no-op if they're already there.
Base.metadata.create_all(bind=engine)

# CNC_ID = "CNC-204"
# GR_ID = "GR-150"
LATHE_ID = "LATHE-MACHINE"

DEMO_MEASURES = {
    # CNC_ID: [
    #     ("Power down before adjusting",
    #      "Before opening the machine guard, press the emergency stop and switch off "
    #      "the main power. Never adjust the workpiece while the spindle is running."),
    #     ("Wear the right protective gear",
    #      "Put on safety glasses and steel-toe shoes before starting the machine. "
    #      "Tie back loose hair and remove any loose jewellery near the spindle."),
    #     ("Check the coolant line",
    #      "Confirm the coolant line is connected and flowing before you begin cutting. "
    #      "Running dry can overheat the tool and damage the workpiece."),
    #     ("Clear the work area",
    #      "Remove tools, rags, and loose parts from the machine bed before starting a "
    #      "cycle. Keep hands clear of the tool path at all times."),
    # ],
    # GR_ID: [
    #     ("Inspect the grinding wheel",
    #      "Check the wheel for cracks or chips before every shift. A damaged wheel can "
    #      "shatter under load — replace it, don't run it."),
    #     ("Use the wheel guard",
    #      "Never operate the grinder with the wheel guard removed. It's there to catch "
    #      "fragments if the wheel fails."),
    #     ("Stand to the side, not in front",
    #      "Position yourself to the side of the wheel's rotation, not directly in front, "
    #      "in case of a kickback."),
    #     ("Let it reach full speed first",
    #      "Switch on and let the wheel reach full speed before touching it to the "
    #      "workpiece. Feeding too early can crack the wheel."),
    # ],
    LATHE_ID: [
        ("Secure the workpiece fully",
         "Make sure the workpiece is clamped tight in the chuck before starting. A "
         "loose piece can fly out at speed."),
        ("Remove the chuck key first",
         "Always remove the chuck key immediately after tightening — never start the "
         "lathe with the key still in place."),
        ("No gloves near the spindle",
         "Don't wear gloves while the lathe is running. Loose fabric can get caught and "
         "pull your hand into the workpiece."),
        ("Use the tailstock for long pieces",
         "For long workpieces, support the far end with the tailstock to stop it "
         "whipping or bending while turning."),
    ],
}


def seed():
    db = SessionLocal()
    try:
        for machine_id, measures in DEMO_MEASURES.items():
            deleted = (
                db.query(SafetyMeasure)
                .filter(SafetyMeasure.machine_id == machine_id)
                .delete()
            )
            db.commit()

            for i, (title, content) in enumerate(measures, start=1):
                db.add(SafetyMeasure(
                    id=str(uuid.uuid4()),
                    machine_id=machine_id,
                    title=title,
                    content=content,
                    sort_order=i,
                    is_active=True,
                    language_code="en-IN",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                ))
            db.commit()

            print(f"{machine_id}: cleared {deleted} old measure(s), added {len(measures)} new.")
    finally:
        db.close()

    print("\nDone. Now make sure a worker is assigned to these machines")
    print("(admin panel -> Workers & machines), then log in as that worker")
    print("and open the 'Machine safety' tab.")


if __name__ == "__main__":
    seed()