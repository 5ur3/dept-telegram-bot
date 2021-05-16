import fs from 'fs'

interface User {
  name: string
  alias: string
}
interface BuyItem {
  name: string
  by: number[]
}
interface Data {
  depts: Record<string, Record<string, number>>
  users: Record<string, User>
  buyList: BuyItem[]
}

export default class Manager {
  data: Data
  constructor() {
    this.data = JSON.parse(fs.readFileSync('data.json', 'utf-8'))
  }

  saveData = async () =>
    fs.writeFileSync('data.json', JSON.stringify(this.data), { encoding: 'utf-8' })
  getUserName = (id: number) => {
    if (this.data.users[id.toString()])
      return this.data.users[id.toString()].name
    return ('' + undefined)
  }
  addUser = (id: number, name: string, alias: string) => {
    if (!this.data.users[id.toString()]) {
      this.data.users[id.toString()] = { name: name, alias: alias }
      this.data.depts[id.toString()] = {}
      for (let keyId in this.data.depts) {
        if (keyId == id.toString())
          continue;
        this.data.depts[keyId][id.toString()] = 0
        this.data.depts[id.toString()][keyId] = 0
      }
      this.saveData()
    }
  }
  getUsers = (): any[] => {
    let users = []
    for (let id in this.data.users)
      users.push({ id: parseInt(id), name: this.data.users[id].name, alias: this.data.users[id].alias })
    return users
  }
  shareMoney = (toUserId: number, fromUserIds: number[], amount: number) => {
    const dept = amount / fromUserIds.length
    fromUserIds.forEach(fromUserId => {
      if (fromUserId == toUserId)
        return

      this.data.depts[fromUserId][toUserId] += dept
      this.data.depts[toUserId][fromUserId] -= dept
    });

    this.saveData()
  }
  addBuyItem = (usersShare: number[], name: string) => {
    this.data.buyList.push({ name: name, by: usersShare })
    this.saveData()
  }
  editBuyItemBy = (index: number, usersShare: number[]) => {
    this.data.buyList[index].by = usersShare
    this.saveData()
  }
  getOutgoingDepts = (userId: number) => {
    if (!this.data.depts[userId.toString()])
      return []

    let depts = []
    for (let toUserId in this.data.depts[userId.toString()]) {
      const dept = this.data.depts[userId.toString()][toUserId]
      if (dept > 0)
        depts.push({ userId: parseInt(toUserId), amount: dept })
    }
    return depts
  }
  getIncomingDepts = (userId: number) => {
    if (!this.data.depts[userId.toString()])
      return []

    let depts = []
    for (let toUserId in this.data.depts[userId.toString()]) {
      const dept = this.data.depts[userId.toString()][toUserId]
      if (dept < 0)
        depts.push({ userId: parseInt(toUserId), amount: -dept })
    }
    return depts
  }
  setDept = (fromUserId: number, toUserId: number, amount: number) => {
    this.data.depts[fromUserId.toString()][toUserId.toString()] = amount
    this.data.depts[toUserId.toString()][fromUserId.toString()] = -amount
    this.saveData()
  }
  deleteBuyItems = (indicies: number[]) => {
    indicies.sort()
    for (let i = indicies.length - 1; i >= 0; i--)
      this.data.buyList.splice(indicies[i], 1)
    this.saveData()
  }
}
