# -*- coding: utf-8 -*-
"""Executa sem alteração o fixture congelado na rodada 14."""
from pathlib import Path
import runpy


runpy.run_path(str(
    Path(__file__).resolve().parents[1]
    / "2026-09-04-14-coluna-bem-ganho-capital"
    / "medir-coluna-bem.py"
))
