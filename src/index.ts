import Telegram from './telegram'
import Manager from './manager'
import fs from 'fs'

interface Config {
  telegramToken: string,
  chatId: number
}

const config: Config = JSON.parse(fs.readFileSync('conf.json', 'utf-8'))
const manager: Manager = new Manager()
new Telegram(config.telegramToken, config.chatId, manager)
