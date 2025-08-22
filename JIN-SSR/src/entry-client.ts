import './style.css'
import { createApp } from './main'
// import { httpPlugin } from './plugins/httpPlugin'

const { app, router } = createApp()

// app.use(httpPlugin)
router.isReady().then(() => {
  app.mount('#app')
})

