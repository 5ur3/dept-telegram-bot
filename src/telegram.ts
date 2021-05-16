import TelegramBot from 'node-telegram-bot-api'
import Manager from './manager'
import { MANAGE, SHARE, SWITCH, OK, CANCEL, EDIT, SHARE_SHORT, INFO, VIEWBUY, BOUGHT, EDITBY, DELETE, BUY } from './commands'
import { CHECK, CROSS, PEOPLE } from './emoji'
import fs from 'fs'
const md5 = require('md5')

const callbackQueryRedirectKey = (userId: number, messageId: number): string =>
  md5(md5(userId.toString()) + md5(messageId.toString()))

export default class Telegram {
  bot: TelegramBot
  manager: Manager
  messageRedirects: Record<number, ((message: TelegramBot.Message) => any) | undefined> = {}
  callbackQueryRedirects: Record<string, ((query: TelegramBot.CallbackQuery) => any) | undefined> = {}
  chatId: number

  constructor(token: string, chatId: number, manager: Manager) {
    this.bot = new TelegramBot(token, { polling: true, request: { url: '' } });
    this.manager = manager
    this.chatId = chatId

    this.bot.on('message', this.messageHandler)
    this.bot.on('callback_query', this.callbackQueryHandler)
    this.bot.on('new_chat_members', this.newChatMemberHandler)
  }
  onReply = (userId: number, callback: (message: TelegramBot.Message) => any) =>
    this.messageRedirects[userId] = callback
  onCallbackQuery = (userId: number, messageId: number, callback: (query: TelegramBot.CallbackQuery) => any) =>
    this.callbackQueryRedirects[callbackQueryRedirectKey(userId, messageId)] = callback
  cancelCallbackQuery = (userId: number, messageId: number) =>
    this.callbackQueryRedirects[callbackQueryRedirectKey(userId, messageId)] = undefined

  shareHandler = async (chatId: number, userId: number, amount: number, shareMessage: string) => {
    const text = `${this.manager.getUserName(userId)}, who shares *${amount}*$?`
    let keyboard: TelegramBot.InlineKeyboardButton[][] = [[]]
    let users = this.manager.getUsers()
    const updateKeyboard = () => {
      keyboard = [[]]
      users.forEach(user => {
        if (keyboard[keyboard.length - 1].length >= 2)
          keyboard.push([])
        keyboard[keyboard.length - 1].push({ text: `${user.shares ? CHECK : CROSS} ${user.name}`, callback_data: user.id.toString() })
      });
      keyboard[keyboard.length - 1].push({ text: `${PEOPLE} Toggle everyone`, callback_data: SWITCH })
      keyboard.push([])
      keyboard[keyboard.length - 1].push({ text: `Cancel`, callback_data: CANCEL })
      keyboard[keyboard.length - 1].push({ text: `Ok`, callback_data: OK })
    }
    users.forEach(user => {
      if (user.id == userId)
        user.shares = true
      else
        user.shares = false
    });

    updateKeyboard()
    const message = await this.bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' })
    this.onCallbackQuery(userId, message.message_id, async (query: TelegramBot.CallbackQuery) => {
      if (query.data == SWITCH) {
        let dontShare = 0
        users.forEach(user => {
          if (!user.shares)
            dontShare++
        })
        if (dontShare) {
          users.forEach(user =>
            user.shares = true
          )
        } else {
          users.forEach(user =>
            user.shares = false
          )
        }
      } else if (query.data == OK) {
        let share = 0
        users.forEach(user => {
          if (user.shares)
            share++
        })

        if (!share) {
          this.bot.editMessageText(`${text}\n\n*At least 1 member must be chosen*`, { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' })
          return
        }

        let fromUserIds: number[] = []
        users.forEach(user => {
          if (user.shares)
            fromUserIds.push(user.id)
        });
        this.manager.shareMoney(userId, fromUserIds, amount)

        let shareNamesStr = ''
        users.forEach(user => {
          if (user.shares) {
            shareNamesStr += ` ${user.name},`
            if (user.id != userId)
              this.bot.sendMessage(user.id, `You owe *${Math.round(amount / share)}*$ *${this.manager.getUserName(userId)}*\n_${shareMessage}_`, { parse_mode: 'Markdown' })
          }
        });
        this.cancelCallbackQuery(userId, message.message_id)
        return this.bot.editMessageText(`*${amount}*$ for *${this.manager.getUserName(userId)}* shared between:*${shareNamesStr.substring(0, shareNamesStr.length - 1)}*`, { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'Markdown' })
      } else if (query.data == CANCEL) {
        this.cancelCallbackQuery(userId, message.message_id)
        return this.bot.editMessageText('Cancelled', { chat_id: message.chat.id, message_id: message.message_id })
      } else {
        users.forEach(user => {
          if (query.data == user.id)
            user.shares = !user.shares
        });
      }
      updateKeyboard()
      this.bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: message.chat.id, message_id: message.message_id })
    })
  }
  buyHandler = async (chatId: number, userId: number, itemName: string) => {
    const text = `${this.manager.getUserName(userId)}, Who shares *${itemName}*?`
    let keyboard: TelegramBot.InlineKeyboardButton[][] = [[]]
    let users = this.manager.getUsers()
    const updateKeyboard = () => {
      keyboard = [[]]
      users.forEach(user => {
        if (keyboard[keyboard.length - 1].length >= 2)
          keyboard.push([])
        keyboard[keyboard.length - 1].push({ text: `${user.shares ? CHECK : CROSS} ${user.name}`, callback_data: user.id.toString() })
      });
      keyboard[keyboard.length - 1].push({ text: `${PEOPLE} Toggle everyone`, callback_data: SWITCH })
      keyboard.push([])
      keyboard[keyboard.length - 1].push({ text: `Cancel`, callback_data: CANCEL })
      keyboard[keyboard.length - 1].push({ text: `Ok`, callback_data: OK })
    }
    users.forEach(user => {
      if (user.id == userId)
        user.shares = true
      else
        user.shares = false
    });

    updateKeyboard()
    const message = await this.bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' })
    this.onCallbackQuery(userId, message.message_id, async (query: TelegramBot.CallbackQuery) => {
      if (query.data == SWITCH) {
        let dontShare = 0
        users.forEach(user => {
          if (!user.shares)
            dontShare++
        })
        if (dontShare) {
          users.forEach(user =>
            user.shares = true
          )
        } else {
          users.forEach(user =>
            user.shares = false
          )
        }
      } else if (query.data == OK) {
        let share = 0
        users.forEach(user => {
          if (user.shares)
            share++
        })

        if (!share) {
          this.bot.editMessageText(`${text}\n\n*At least 1 member must be chosen*`, { chat_id: message.chat.id, message_id: message.message_id, reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' })
          return
        }

        let shareUsers: number[] = []
        users.forEach(user => {
          if (user.shares)
            shareUsers.push(user.id)
        });
        this.manager.addBuyItem(shareUsers, itemName)

        let shareNamesStr = ''
        users.forEach(user => {
          if (user.shares) {
            shareNamesStr += ` ${user.name},`
            if (user.id != userId)
              this.bot.sendMessage(user.id, `You now share "*${itemName}*"`, { parse_mode: 'Markdown' })
          }
        });
        this.cancelCallbackQuery(userId, message.message_id)
        return this.bot.editMessageText(`*"${itemName}"* share:*${shareNamesStr.substring(0, shareNamesStr.length - 1)}*`, { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'Markdown' })
      } else if (query.data == CANCEL) {
        this.cancelCallbackQuery(userId, message.message_id)
        return this.bot.editMessageText('Cancelled', { chat_id: message.chat.id, message_id: message.message_id })
      } else {
        users.forEach(user => {
          if (query.data == user.id)
            user.shares = !user.shares
        });
      }
      updateKeyboard()
      this.bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: message.chat.id, message_id: message.message_id })
    })
  }
  manageHandler = async (chatId: number, userId: number) => {
    let outgoing = this.manager.getOutgoingDepts(userId)
    let incoming = this.manager.getIncomingDepts(userId)

    const generateText = () => {
      outgoing = this.manager.getOutgoingDepts(userId)
      incoming = this.manager.getIncomingDepts(userId)
      if (!incoming.length && !outgoing.length)
        return `${this.manager.getUserName(userId)} don't owe anyone and no one owes ${this.manager.getUserName(userId)}.`
      let text = `${this.manager.getUserName(userId)},\n\n`
      if (incoming.length) {
        let sum = 0
        incoming.forEach(dept => { sum += dept.amount });
        text += `Members owe you ${Math.round(sum)}$:\n`
        incoming.forEach(dept => { text += `${this.manager.getUserName(dept.userId)} - ${Math.round(dept.amount)}\n` })
      }
      if (outgoing.length) {
        if (incoming.length)
          text += '\n'

        let sum = 0
        outgoing.forEach(dept => { sum += dept.amount });
        text += `You owe ${Math.round(sum)}$:\n`
        outgoing.forEach(dept => { text += `${this.manager.getUserName(dept.userId)} - ${Math.round(dept.amount)}\n` })
      }
      return text
    }

    const message = await this.bot.sendMessage(chatId, generateText(), outgoing.length ? { reply_markup: { inline_keyboard: [[{ text: 'Change', callback_data: EDIT }]] } } : {})
    const reset = () =>
      this.bot.editMessageText(`${generateText()}`, { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard: outgoing.length ? [[{ text: 'Change', callback_data: EDIT }]] : [] } })

    this.onCallbackQuery(userId, message.message_id, (query: TelegramBot.CallbackQuery) => {
      if (query.data == EDIT) {
        let keyboard: TelegramBot.InlineKeyboardButton[][] = [[]]
        outgoing.forEach(dept => {
          if (keyboard[keyboard.length - 1].length >= 2)
            keyboard.push([])
          keyboard[keyboard.length - 1].push({ text: this.manager.getUserName(dept.userId), callback_data: dept.userId.toString() })
        });
        keyboard.push([])
        keyboard[keyboard.length - 1].push({ text: 'Cancel', callback_data: CANCEL })
        this.bot.editMessageText(`${generateText()}\nChose a person who you paid:`, { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard: keyboard } })
      } else if (query.data == CANCEL)
        reset()
      else if (query.data && !isNaN(parseInt(query.data)) && parseInt(query.data).toString().length == query.data.length) { // pure number - user id
        for (let i = 0; i < outgoing.length; i++) {
          const dept = outgoing[i];
          if (dept.userId.toString() == query.data) {
            this.bot.editMessageText(`${generateText()}\nDept to ${this.manager.getUserName(dept.userId)}:`, { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard: [[{ text: 'Paid everything', callback_data: `a${query.data}` }], [{ text: 'Paid a portion', callback_data: `p${query.data}` }], [{ text: 'Cancel', callback_data: CANCEL }]] } })
            break;
          }
        }
      } else { // not that pure number
        if (!query.data)
          return;
        const toUserId = parseInt(query.data.substring(1))
        if (query.data.substring(0, 1) == 'a') {
          this.bot.sendMessage(chatId, `${this.manager.getUserName(userId)} paid ${this.manager.getUserName(toUserId)} ${Math.round(this.manager.data.depts[userId.toString()][toUserId.toString()])}$`)
          this.bot.sendMessage(toUserId, `${this.manager.getUserName(userId)} paid you ${Math.round(this.manager.data.depts[userId.toString()][toUserId.toString()])}$`)
          this.manager.setDept(userId, toUserId, 0)
          reset()
        } else if (query.data.substring(0, 1) == 'p') {
          this.bot.editMessageText(`${generateText()}\nEnter the amount you paid:`, { chat_id: chatId, message_id: message.message_id })
          this.onReply(userId, (reply: TelegramBot.Message) => {
            const reset = () =>
              this.bot.editMessageText(`${generateText()}\nEnter a positive number, not exceeding your dept.`, { chat_id: chatId, message_id: message.message_id, reply_markup: { inline_keyboard: outgoing.length ? [[{ text: 'Change', callback_data: EDIT }]] : [] } })

            if (!reply.text)
              return reset()
            const part = parseInt(reply.text)
            if (isNaN(part))
              return reset()
            if (part > this.manager.data.depts[userId.toString()][toUserId.toString()] || part <= 0)
              return reset()
            this.bot.sendMessage(chatId, `${this.manager.getUserName(userId)} paid ${this.manager.getUserName(toUserId)} ${part}$. Dept left - ${Math.round(this.manager.data.depts[userId.toString()][toUserId.toString()]) - part}$`)
            this.bot.sendMessage(toUserId, `${this.manager.getUserName(userId)} paid you ${part}$. Dept left - ${Math.round(this.manager.data.depts[userId.toString()][toUserId.toString()]) - part}$`)
            this.manager.setDept(userId, toUserId, this.manager.data.depts[userId.toString()][toUserId.toString()] - part)
          })
        }
      }
    })
  }
  infoHandler = async (chatId: number) => {
    this.bot.sendMessage(chatId, fs.readFileSync('info.txt', 'utf-8'))
  }
  viewBuyHandler = async (chatId: number, userId: number) => {
    let numberOfItemsInLatestText = 0
    const generateMainText = (): string => {
      let text = `*${this.manager.getUserName(userId)}*, Buy list:\n\n`
      text += 'Things you share:\n'
      let count = 0
      this.manager.data.buyList.forEach(buyItem => {
        if (buyItem.by.includes(userId)) {
          text += `*${++count}) ${buyItem.name}*\n`
          text += '('
          buyItem.by.forEach(userId => {
            text += `${this.manager.getUserName(userId)}, `
          });
          text = text.substring(0, text.length - 2)
          text += ')\n'
        }
      });
      text += '\n'
      text += 'Things you don\'t share:\n'
      this.manager.data.buyList.forEach(buyItem => {
        if (!buyItem.by.includes(userId)) {
          text += `*${++count})* ${buyItem.name}\n`
          text += '('
          buyItem.by.forEach(userId => {
            text += `${this.manager.getUserName(userId)}, `
          });
          text = text.substring(0, text.length - 2)
          text += ')\n'
        }
      });
      numberOfItemsInLatestText = count
      return text
    }
    const mainKeyboard: TelegramBot.InlineKeyboardButton[][] = [[{ text: 'Change members who share', callback_data: EDITBY }], [{ text: 'Bought something', callback_data: BOUGHT }], [{ text: 'Remove things', callback_data: DELETE }]]
    const cancelKey: TelegramBot.InlineKeyboardButton = { text: 'Cancel', callback_data: CANCEL }
    const message = await this.bot.sendMessage(chatId, generateMainText(), { parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
    this.onCallbackQuery(userId, message.message_id, (query: TelegramBot.CallbackQuery) => {
      if (query.data == EDITBY) {
        this.bot.editMessageText(`${generateMainText()}\n*Enter the index of the thing you wish to change*`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[cancelKey]] } })
        this.onReply(userId, async (reply: TelegramBot.Message) => {
          if (!reply.text)
            return
          const quit = () =>
            this.bot.editMessageText(`${generateMainText()}\n*Cancelled*`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
          const index = parseInt(reply.text)
          if (isNaN(index) || index.toString() != reply.text || index < 1 || index > this.manager.data.buyList.length)
            return quit()
          const item = this.manager.data.buyList[index - 1]
          const text = `${this.manager.getUserName(userId)}, Who shares *${item.name}*?`
          let keyboard: TelegramBot.InlineKeyboardButton[][] = [[]]
          let users = this.manager.getUsers()
          const updateKeyboard = () => {
            keyboard = [[]]
            users.forEach(user => {
              if (keyboard[keyboard.length - 1].length >= 2)
                keyboard.push([])
              keyboard[keyboard.length - 1].push({ text: `${user.shares ? CHECK : CROSS} ${user.name}`, callback_data: user.id.toString() })
            });
            keyboard[keyboard.length - 1].push({ text: `${PEOPLE} Toggle everyone`, callback_data: SWITCH })
            keyboard.push([])
            keyboard[keyboard.length - 1].push({ text: `Cancel`, callback_data: CANCEL })
            keyboard[keyboard.length - 1].push({ text: `Ok`, callback_data: OK })
          }
          users.forEach(user => {
            if (item.by.includes(user.id))
              user.shares = true
            else
              user.shares = false
          });

          updateKeyboard()
          const editByMessage = await this.bot.sendMessage(chatId, text, { reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' })
          this.bot.editMessageText(`${generateMainText()}`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
          this.onCallbackQuery(userId, editByMessage.message_id, async (query: TelegramBot.CallbackQuery) => {
            if (query.data == SWITCH) {
              let dontShare = 0
              users.forEach(user => {
                if (!user.shares)
                  dontShare++
              })
              if (dontShare) {
                users.forEach(user =>
                  user.shares = true
                )
              } else {
                users.forEach(user =>
                  user.shares = false
                )
              }
            } else if (query.data == OK) {
              let share = 0
              users.forEach(user => {
                if (user.shares)
                  share++
              })

              if (!share) {
                this.bot.editMessageText(`${text}\n\n*At least 1 member must be chosen*`, { chat_id: editByMessage.chat.id, message_id: editByMessage.message_id, reply_markup: { inline_keyboard: keyboard }, parse_mode: 'Markdown' })
                return
              }

              let shareUsers: number[] = []
              users.forEach(user => {
                if (user.shares)
                  shareUsers.push(user.id)
              });

              let shareNamesStr = ''
              users.forEach(user => {
                if (user.shares) {
                  shareNamesStr += ` ${user.name},`
                  if (!item.by.includes(user.id) && user.id != userId)
                    this.bot.sendMessage(user.id, `Now you share "*${item.name}*"`, { parse_mode: 'Markdown' })
                } else {
                  if (item.by.includes(user.id) && user.id != userId)
                    this.bot.sendMessage(user.id, `You don't share "*${item.name}*" anymore`, { parse_mode: 'Markdown' })
                }
              });

              this.manager.editBuyItemBy(index - 1, shareUsers)
              this.cancelCallbackQuery(userId, editByMessage.message_id)
              this.bot.editMessageText(`*"${item.name}"* share:*${shareNamesStr.substring(0, shareNamesStr.length - 1)}*`, { chat_id: editByMessage.chat.id, message_id: editByMessage.message_id, parse_mode: 'Markdown' })
              return this.bot.editMessageText(`${generateMainText()}\n`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
            } else if (query.data == CANCEL) {
              this.cancelCallbackQuery(userId, editByMessage.message_id)
              return this.bot.editMessageText('Cancelled', { chat_id: editByMessage.chat.id, message_id: editByMessage.message_id })
            } else {
              users.forEach(user => {
                if (query.data == user.id)
                  user.shares = !user.shares
              });
            }
            updateKeyboard()
            this.bot.editMessageReplyMarkup({ inline_keyboard: keyboard }, { chat_id: editByMessage.chat.id, message_id: editByMessage.message_id })
          })
        })
      } else if (query.data == BOUGHT) {
        this.bot.editMessageText(`${generateMainText()}\n*Enter the index of the thing and it's cost (1 100)*`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[cancelKey]] } })
        this.onReply(userId, (reply: TelegramBot.Message) => {
          if (!reply.text)
            return
          const quit = () =>
            this.bot.editMessageText(`${generateMainText()}\n*Cancelled*`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })

          let index = parseInt(reply.text.split(' ')[0])
          if (isNaN(index) || index.toString() != reply.text.split(' ')[0] || index < 1 || index > this.manager.data.buyList.length)
            return quit()
          const value = parseFloat(reply.text.split(' ')[1])
          if (isNaN(value) || value.toString() != reply.text.split(' ')[1])
            return quit()

          let indiciesMap: number[] = []
          for (let i = 0; i < this.manager.data.buyList.length; i++) {
            const buyItem = this.manager.data.buyList[i];
            if (buyItem.by.includes(userId))
              indiciesMap.push(i)
          }
          for (let i = 0; i < this.manager.data.buyList.length; i++) {
            const buyItem = this.manager.data.buyList[i];
            if (!buyItem.by.includes(userId))
              indiciesMap.push(i)
          }
          index = indiciesMap[index - 1]
          const buyItem = this.manager.data.buyList[index]
          buyItem.by.forEach(user => {
            if (user != userId)
              this.bot.sendMessage(user, `${this.manager.getUserName(userId)} bought "${buyItem.name}". You owe this member ${Math.round(value / buyItem.by.length)}$`);
          });
          this.manager.shareMoney(userId, buyItem.by, value)
          this.manager.deleteBuyItems([index])
          this.bot.editMessageText(`${generateMainText()}`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
          let forUsersStr = ''
          buyItem.by.forEach(user => {
            forUsersStr += ` ${this.manager.getUserName(user)},`
          });
          forUsersStr = forUsersStr.substring(0, forUsersStr.length - 1)
          this.bot.sendMessage(chatId, `${this.manager.getUserName(userId)} bought *"${buyItem.name}"* for *${forUsersStr}*.`, {parse_mode: 'Markdown'})
        })
      } else if (query.data == DELETE) {
        this.bot.editMessageText(`${generateMainText()}\n*Enter indices of things you wish to remove*`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[cancelKey]] } })
        this.onReply(userId, (reply: TelegramBot.Message) => {
          if (!reply.text)
            return
          const quit = () =>
            this.bot.editMessageText(`${generateMainText()}\n*Cancelled*`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })

          let toDelete: number[] = []
          let failed = false
          reply.text.split(' ').forEach(token => {
            if (failed)
              return
            let index = parseInt(token)
            if (isNaN(index) || index.toString() != token || index <= 0 || index > this.manager.data.buyList.length) {
              failed = true
              return
            }
            index--
            if (!toDelete.includes(index))
              toDelete.push(index)
          });
          if (failed || numberOfItemsInLatestText != this.manager.data.buyList.length)
            return quit()

          let indiciesMap: number[] = []
          for (let i = 0; i < this.manager.data.buyList.length; i++) {
            const buyItem = this.manager.data.buyList[i];
            if (buyItem.by.includes(userId))
              indiciesMap.push(i)
          }
          for (let i = 0; i < this.manager.data.buyList.length; i++) {
            const buyItem = this.manager.data.buyList[i];
            if (!buyItem.by.includes(userId))
              indiciesMap.push(i)
          }
          for (let i = 0; i < toDelete.length; i++)
            toDelete[i] = indiciesMap[toDelete[i]]

          let deletedNamesStr = ''
          toDelete.forEach(element => {
            const buyItem = this.manager.data.buyList[element]
            deletedNamesStr += ` ${buyItem.name},`
            buyItem.by.forEach(user => {
              if (user != userId)
                this.bot.sendMessage(user, `*"${buyItem.name}"*, that you shared, was removed from the buy list`, { parse_mode: 'Markdown' });
            });
          });
          deletedNamesStr = deletedNamesStr.substring(0, deletedNamesStr.length - 1)

          this.manager.deleteBuyItems(toDelete)
          this.bot.editMessageText(`${generateMainText()}`, { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
          this.bot.sendMessage(chatId, `Ok, these items were removed from the buy list: *${deletedNamesStr}*`, { parse_mode: 'Markdown' })
        })
      } else if (query.data == CANCEL) {
        this.messageRedirects[userId] = undefined
        this.bot.editMessageText(generateMainText(), { chat_id: chatId, message_id: message.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: mainKeyboard } })
      }
    })
  }
  messageHandler = async (message: TelegramBot.Message) => {
    if (!message.text || !message.from)
      return

    if (message.chat.id != this.chatId) {
      if (this.manager.getUserName(message.chat.id) == 'undefined')
        return
      if (message.text.substring(0, SHARE.length) == SHARE || message.text.substring(0, SHARE_SHORT.length) == SHARE_SHORT)
        return this.bot.sendMessage(message.chat.id, 'This command works only in the main group.')
    }

    const redirect = this.messageRedirects[message.from.id]
    if (redirect) {
      this.messageRedirects[message.from.id] = undefined
      return redirect(message)
    }

    if (message.text.substring(0, MANAGE.length) == MANAGE)
      return this.manageHandler(message.chat.id, message.from.id)
    if (message.text.substring(0, INFO.length) == INFO)
      return this.infoHandler(message.chat.id)
    if (message.text.substring(0, SHARE.length) == SHARE || message.text.substring(0, SHARE_SHORT.length) == SHARE_SHORT) {
      const quit = () =>
        this.bot.sendMessage(message.chat.id, `Enter nonzero number, like that: \n\n_${SHARE} 100\or\n${SHARE_SHORT} 100_`, { parse_mode: 'Markdown' })
      if (message.text.indexOf(' ') != -1) {
        const amountStr = message.text.split(' ')[1]
        const amount = parseFloat(amountStr)
        if (isNaN(amount))
          return quit()
        if (amount == 0)
          return quit()
        if (amount.toString() != amountStr)
          return quit()

        const shareMessage = message.text.split(' ').reduce((prev, cur, index, arr) => {
          if (index < 2)
            return prev
          if (prev.length)
            prev += ' '
          return prev + cur
        }, '');
        return this.shareHandler(message.chat.id, message.from.id, amount, shareMessage)
      } else
        return quit()
    }
    if (message.text.substring(0, BUY.length) == BUY) {
      const quit = () =>
        this.bot.sendMessage(message.chat.id, `Enter name of the item: \n\n_${BUY} Beer\n_`, { parse_mode: 'Markdown' })
      if (message.text.indexOf(' ') == -1)
        return quit()
      const name = message.text.substring(message.text.indexOf(' ') + 1, message.text.length)
      return this.buyHandler(message.chat.id, message.from.id, name)
    }
    if (message.text.substring(0, VIEWBUY.length) == VIEWBUY) {
      return this.viewBuyHandler(message.chat.id, message.from.id)
    }
  }
  callbackQueryHandler = async (query: TelegramBot.CallbackQuery) => {
    if (!query.message)
      return

    const redirect = this.callbackQueryRedirects[callbackQueryRedirectKey(query.from.id, query.message.message_id)]
    if (redirect)
      return redirect(query)
  }
  newChatMemberHandler = async (query: TelegramBot.Message) => {
    if (query.new_chat_members) {
      query.new_chat_members.forEach(member => {
        this.manager.addUser(member.id, member.first_name, `@${member.username} `)
      });
    }
  }
} 
