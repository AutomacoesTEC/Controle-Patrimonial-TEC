# -*- coding: utf-8 -*-
"""Executa o fixture congelado, idêntico ao da rodada anterior."""
from pathlib import Path
import runpy


runpy.run_path(str(
    Path(__file__).resolve().parents[1]
    / "2026-09-04-12-grade-quatro-cards"
    / "medir-grade.py"
))
