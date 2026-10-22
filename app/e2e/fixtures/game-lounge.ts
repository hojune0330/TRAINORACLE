import { expect, type Page } from '@playwright/test'

/** Close the intentional first-visit pet home before selecting a game behind it. */
export async function dismissInitialPetHome(page: Page) {
  const petHome = page.getByRole('dialog', { name: '우리 집 친구들', exact: true })
  await expect(petHome).toBeVisible()
  await petHome.getByLabel('다른 게임 보기', { exact: true }).click()
  await expect(petHome).not.toBeVisible()
}
