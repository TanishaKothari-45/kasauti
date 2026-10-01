"""Versioned prompts. A behaviour change means a new file, so versions can be compared."""

from importlib.resources import files

PROMPT_VERSION = "receptionist_v1"
SYSTEM_PROMPT = files(__package__).joinpath(f"{PROMPT_VERSION}.md").read_text(encoding="utf-8")

GREETING = "Namaste! Main Asha hoon, Arogya Clinic se. Appointment book karna hai, ya kuch aur?"
