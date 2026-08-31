"""Remove o fundo branco externo do logotipo e gera o ICO do Windows."""

from __future__ import annotations

import math
import sys
from collections import deque
from pathlib import Path

from PIL import Image


LIMITE_CONEXAO_EXTERNA = 310.0
DISTANCIA_PRIMEIRO_PLANO = 335.0


def distancia_do_branco(pixel: tuple[int, int, int, int]) -> float:
    r, g, b, _ = pixel
    return math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2)


def remover_fundo_externo(imagem: Image.Image) -> Image.Image:
    original = imagem.convert("RGBA")
    if original.getchannel("A").getextrema()[0] < 255:
        return original
    largura, altura = original.size
    pixels = original.load()
    externo = bytearray(largura * altura)
    fila: deque[tuple[int, int]] = deque()

    def adicionar(x: int, y: int) -> None:
        indice = y * largura + x
        if externo[indice]:
            return
        if distancia_do_branco(pixels[x, y]) >= LIMITE_CONEXAO_EXTERNA:
            return
        externo[indice] = 1
        fila.append((x, y))

    for x in range(largura):
        adicionar(x, 0)
        adicionar(x, altura - 1)
    for y in range(altura):
        adicionar(0, y)
        adicionar(largura - 1, y)

    while fila:
        x, y = fila.popleft()
        if x > 0:
            adicionar(x - 1, y)
        if x + 1 < largura:
            adicionar(x + 1, y)
        if y > 0:
            adicionar(x, y - 1)
        if y + 1 < altura:
            adicionar(x, y + 1)

    saida = original.copy()
    destino = saida.load()
    for y in range(altura):
        for x in range(largura):
            if not externo[y * largura + x]:
                continue
            r, g, b, _ = pixels[x, y]
            distancia = distancia_do_branco((r, g, b, 255))
            alfa = max(0.0, min(1.0, distancia / DISTANCIA_PRIMEIRO_PLANO))
            if alfa <= 0.01:
                destino[x, y] = (0, 0, 0, 0)
                continue
            # Desfaz a mistura da borda antialias com o antigo fundo branco.
            canais = tuple(
                max(0, min(255, round(255 - (255 - canal) / alfa)))
                for canal in (r, g, b)
            )
            destino[x, y] = (*canais, round(alfa * 255))
    return saida


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("uso: make_transparent_icon.py origem.png destino.png destino.ico")
    origem, destino_png, destino_ico = map(Path, sys.argv[1:])
    imagem = remover_fundo_externo(Image.open(origem))
    imagem.save(destino_png, format="PNG", optimize=True)
    imagem.save(
        destino_ico,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
