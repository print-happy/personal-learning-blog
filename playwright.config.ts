import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir:'./tests/e2e',timeout:90000,expect:{timeout:12000},fullyParallel:false,workers:1,
  reporter:[['list'],['html',{open:'never'}]],
  webServer:process.env.TEST_BASE_URL?undefined:{command:'node scripts/test-preview.mjs',url:'http://127.0.0.1:4177',timeout:120000},
  use:{baseURL:process.env.TEST_BASE_URL||'http://127.0.0.1:4177',headless:true,channel:process.env.BROWSER_CHANNEL||'msedge',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'desktop'}]
})
