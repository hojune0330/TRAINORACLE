import { expect, type Page } from '@playwright/test'

/** Explicitly visit the pet home, then close it before selecting a game. */
export async function dismissInitialPetHome(page: Page) {
  const petHome = page.getByRole('dialog', { name: '우리 집 친구들', exact: true })
  await page.getByRole('button', { name: /^우리 집 친구들/ }).click()
  await expect(petHome).toBeVisible()
  await petHome.getByLabel('다른 게임 보기', { exact: true }).click()
  await expect(petHome).not.toBeVisible()
}
