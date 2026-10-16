import {defineConfig} from '@playwright/test'
import base from './playwright.treadmill.config'
export default defineConfig({...base,testMatch:'tower-defense.spec.ts',timeout:180_000,outputDir:'./test-results/tower-defense',use:{...base.use,baseURL:process.env.TD_BASE_URL??'http://127.0.0.1:4253'},webServer:undefined})
