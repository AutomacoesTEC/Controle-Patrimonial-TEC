import { test, expect } from '@playwright/test';

// Perfil de teste isolado por execução: localStorage é por origem (mesma
// porta 4173 sempre), então sem isso um teste veria o perfil que o anterior
// criou. Cada teste começa de fato vazio.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('instalação nova (zero perfis) vai direto para "Novo titular"', async ({ page }) => {
  // Confirmado rodando de verdade: com perfis.length === 0 o app pula a
  // tela de seleção (não faria sentido mostrar uma lista vazia) e abre
  // direto o cadastro, com "Criar e Entrar" desabilitado até ter nome.
  await expect(page.getByRole('heading', { name: 'Novo titular' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar e Entrar' })).toBeDisabled();
});

test('cadastro manual de titular leva ao app principal', async ({ page }) => {
  await page.getByLabel('Nome do Titular').fill('Perfil de Teste E2E');
  await expect(page.getByRole('button', { name: 'Criar e Entrar' })).toBeEnabled();
  await page.getByRole('button', { name: 'Criar e Entrar' }).click();

  // A sidebar não mostra o nome do titular (confirmado rodando: só marca fixa
  // + navegação), então a prova de que caiu no app de verdade é a navegação
  // principal aparecer no lugar da tela de cadastro.
  await expect(page.getByRole('heading', { name: 'Novo titular' })).toBeHidden();
  await expect(page.locator('.sidebar').getByText('Demonstrativo')).toBeVisible();
});
