import typer
from rich.console import Console

app = typer.Typer(help="Kasauti: break, measure and grade voice agents.", no_args_is_help=True)
console = Console()


@app.command()
def info() -> None:
    """Show what Kasauti will do, and when each part gets built."""
    console.print("[bold]Kasauti[/bold]: the touchstone for voice agents")
    console.print("  distortions  noise, 8 kHz phone line, packet loss, echo       (Day 7)")
    console.print("  stt-bench    real Indian speech x distortions -> error rates  (Day 8)")
    console.print("  callers      persona scripts -> cached caller audio -> calls  (Day 9)")
    console.print("  graders      state-diff, language, barge-in, latency, judge   (Day 10)")
    console.print("  run          baseline and optimisation rounds                (Day 11+)")


@app.command()
def version() -> None:
    """Print the version."""
    console.print("kasauti 0.1.0")
