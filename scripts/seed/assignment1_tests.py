import io
import contextlib


def run_and_capture(student_code: str) -> str:
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        exec(student_code, {})
    return buffer.getvalue().strip()


def test_summary_format(student_code):
    output = run_and_capture(student_code)
    assert " is " in output
    assert "years old" in output
    assert "m tall" in output
    assert "learning to code:" in output
