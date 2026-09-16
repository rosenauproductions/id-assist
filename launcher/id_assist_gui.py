#!/usr/bin/env python3
"""ID Assist launcher GUI — start, open, and stop the local Next.js app."""

from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import scrolledtext, messagebox

ROOT = Path(__file__).resolve().parent.parent
URL = "http://localhost:3000"
PORT = 3000


class IdAssistLauncher(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("ID Assist")
        self.geometry("520x420")
        self.minsize(480, 360)
        self.configure(bg="#f4f6f8")

        self.process: subprocess.Popen[str] | None = None
        self._stop_log = threading.Event()

        header = tk.Frame(self, bg="#f4f6f8")
        header.pack(fill="x", padx=20, pady=(18, 8))

        tk.Label(
            header,
            text="ID Assist",
            font=("Helvetica Neue", 20, "bold"),
            bg="#f4f6f8",
            fg="#12161c",
        ).pack(anchor="w")
        tk.Label(
            header,
            text="Local instructional-design compiler",
            font=("Helvetica Neue", 11),
            bg="#f4f6f8",
            fg="#5b6573",
        ).pack(anchor="w")

        self.status = tk.StringVar(value="Stopped")
        self.status_dot = tk.Canvas(
            header, width=12, height=12, bg="#f4f6f8", highlightthickness=0
        )
        status_row = tk.Frame(header, bg="#f4f6f8")
        status_row.pack(anchor="w", pady=(10, 0))
        self.status_dot.pack_forget()
        self.status_dot = tk.Canvas(
            status_row, width=12, height=12, bg="#f4f6f8", highlightthickness=0
        )
        self.status_dot.pack(side="left", padx=(0, 8))
        self._set_dot("#9aa3af")
        tk.Label(
            status_row,
            textvariable=self.status,
            font=("Helvetica Neue", 12, "bold"),
            bg="#f4f6f8",
            fg="#12161c",
        ).pack(side="left")

        buttons = tk.Frame(self, bg="#f4f6f8")
        buttons.pack(fill="x", padx=20, pady=8)

        self.btn_start = tk.Button(
            buttons,
            text="Start",
            command=self.start_server,
            width=12,
            font=("Helvetica Neue", 12, "bold"),
            bg="#12161c",
            fg="white",
            activebackground="#2a3140",
            activeforeground="white",
            relief="flat",
            padx=8,
            pady=8,
        )
        self.btn_start.pack(side="left", padx=(0, 8))

        self.btn_open = tk.Button(
            buttons,
            text="Open app",
            command=self.open_browser,
            width=12,
            font=("Helvetica Neue", 12),
            bg="white",
            fg="#12161c",
            relief="solid",
            borderwidth=1,
            padx=8,
            pady=8,
            state="disabled",
        )
        self.btn_open.pack(side="left", padx=(0, 8))

        self.btn_stop = tk.Button(
            buttons,
            text="Stop",
            command=self.stop_server,
            width=12,
            font=("Helvetica Neue", 12),
            bg="white",
            fg="#b42318",
            relief="solid",
            borderwidth=1,
            padx=8,
            pady=8,
            state="disabled",
        )
        self.btn_stop.pack(side="left")

        path_row = tk.Frame(self, bg="#f4f6f8")
        path_row.pack(fill="x", padx=20, pady=(4, 8))
        tk.Label(
            path_row,
            text=str(ROOT),
            font=("Menlo", 9),
            bg="#f4f6f8",
            fg="#5b6573",
            wraplength=470,
            justify="left",
        ).pack(anchor="w")

        tk.Label(
            self,
            text="Log",
            font=("Helvetica Neue", 11, "bold"),
            bg="#f4f6f8",
            fg="#12161c",
        ).pack(anchor="w", padx=20)

        self.log = scrolledtext.ScrolledText(
            self,
            height=14,
            font=("Menlo", 10),
            bg="white",
            fg="#12161c",
            relief="solid",
            borderwidth=1,
        )
        self.log.pack(fill="both", expand=True, padx=20, pady=(4, 16))
        self.log.configure(state="disabled")

        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self.after(800, self._poll_ready)
        self._log(f"Project: {ROOT}")
        if self._port_open():
            self.status.set("Already running on :3000")
            self._set_dot("#1f6b5a")
            self.btn_open.configure(state="normal")
            self.btn_stop.configure(state="normal")
            self._log("Detected an existing server on port 3000.")

    def _set_dot(self, color: str) -> None:
        self.status_dot.delete("all")
        self.status_dot.create_oval(1, 1, 11, 11, fill=color, outline=color)

    def _log(self, message: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", message.rstrip() + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _port_open(self) -> bool:
        try:
            with urllib.request.urlopen(URL, timeout=0.6) as response:
                return 200 <= response.status < 500
        except Exception:
            return False

    def _poll_ready(self) -> None:
        if self.process is not None and self.process.poll() is None:
            if self._port_open():
                if self.status.get() != "Running":
                    self.status.set("Running")
                    self._set_dot("#1f6b5a")
                    self.btn_open.configure(state="normal")
                    self._log(f"Ready at {URL}")
        elif self.process is not None and self.process.poll() is not None:
            code = self.process.returncode
            self.process = None
            self.status.set(f"Stopped (exit {code})")
            self._set_dot("#9aa3af")
            self.btn_start.configure(state="normal")
            self.btn_stop.configure(state="disabled")
            if not self._port_open():
                self.btn_open.configure(state="disabled")
        self.after(1000, self._poll_ready)

    def start_server(self) -> None:
        if self.process is not None and self.process.poll() is None:
            self._log("Server is already started from this launcher.")
            return
        if self._port_open():
            self.status.set("Running")
            self._set_dot("#1f6b5a")
            self.btn_open.configure(state="normal")
            self.btn_stop.configure(state="normal")
            self._log("Server already up — use Open or Stop.")
            return

        if not (ROOT / "package.json").exists():
            messagebox.showerror("ID Assist", f"package.json not found in:\n{ROOT}")
            return
        if not (ROOT / "node_modules").exists():
            messagebox.showwarning(
                "ID Assist",
                "node_modules is missing. Run npm install in the project folder first.",
            )
            return

        self.status.set("Starting…")
        self._set_dot("#9a6700")
        self.btn_start.configure(state="disabled")
        self.btn_stop.configure(state="normal")
        self._log("Starting npm run dev…")

        env = os.environ.copy()
        env["FORCE_COLOR"] = "0"
        try:
            self.process = subprocess.Popen(
                ["npm", "run", "dev"],
                cwd=str(ROOT),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
        except FileNotFoundError:
            self.btn_start.configure(state="normal")
            self.btn_stop.configure(state="disabled")
            self.status.set("Stopped")
            self._set_dot("#9aa3af")
            messagebox.showerror("ID Assist", "npm was not found on PATH.")
            return

        self._stop_log.clear()
        threading.Thread(target=self._read_output, daemon=True).start()

    def _read_output(self) -> None:
        assert self.process is not None
        assert self.process.stdout is not None
        for line in self.process.stdout:
            if self._stop_log.is_set():
                break
            text = line.rstrip()
            if text:
                self.after(0, self._log, text)

    def open_browser(self) -> None:
        if not self._port_open() and (
            self.process is None or self.process.poll() is not None
        ):
            messagebox.showinfo("ID Assist", "Start the server first.")
            return
        webbrowser.open(URL)
        self._log(f"Opened {URL}")

    def stop_server(self) -> None:
        self._stop_log.set()
        stopped = False

        if self.process is not None and self.process.poll() is None:
            self._log("Stopping server…")
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
            except ProcessLookupError:
                self.process.terminate()
            try:
                self.process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(self.process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    self.process.kill()
            self.process = None
            stopped = True

        # Also clear anything still bound to :3000 (e.g. orphan next)
        try:
            result = subprocess.run(
                ["lsof", "-ti", f":{PORT}"],
                capture_output=True,
                text=True,
                check=False,
            )
            pids = [p for p in result.stdout.split() if p.isdigit()]
            for pid in pids:
                try:
                    os.kill(int(pid), signal.SIGTERM)
                    stopped = True
                    self._log(f"Stopped pid {pid} on :{PORT}")
                except ProcessLookupError:
                    pass
        except FileNotFoundError:
            pass

        time.sleep(0.4)
        self.status.set("Stopped")
        self._set_dot("#9aa3af")
        self.btn_start.configure(state="normal")
        self.btn_stop.configure(state="disabled")
        if not self._port_open():
            self.btn_open.configure(state="disabled")
        if not stopped:
            self._log("Nothing to stop.")
        else:
            self._log("Server stopped.")

    def on_close(self) -> None:
        if self.process is not None and self.process.poll() is None:
            if messagebox.askyesno(
                "ID Assist",
                "Server is still running. Stop it and quit?",
            ):
                self.stop_server()
                self.destroy()
            return
        self.destroy()


def main() -> None:
    app = IdAssistLauncher()
    app.mainloop()


if __name__ == "__main__":
    main()
