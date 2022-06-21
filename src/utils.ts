import { createObjectCsvWriter } from 'csv-writer'
import { ObjectStringifierHeader } from 'csv-writer/src/lib/record'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import 'isomorphic-fetch'
import { TransactionParsed } from './export-transactions'
import { KPI } from './interfaces/KPIs'
import { Network } from './interfaces/Network'
import { TransferType } from './interfaces/Transactions/Transfers'

export const wallets = [
  [Network.ETHEREUM, "0x9a6ebe7e2a7722f8200d0ffb63a1f6406a0d7dce", "Aragon Agent"],
  [Network.ETHEREUM, "0x89214c8ca9a49e60a3bfa8e00544f384c93719b1", "DAO Committee"],
  [Network.POLYGON, "0xb08e3e7cc815213304d884c88ca476ebc50eaab2", "DAO Committee"],
]

export function sum(array: number[]) {
  return array.reduce((prev, curr) => prev + curr, 0)
}

export function avg(array: number[]) {
  return sum(array) / array.length
}

export function median(array: number[]) {
  if (array.length === 0) throw new Error("Median: no inputs")

  array.sort((a, b) => a - b)
  const half = Math.floor(array.length / 2)

  if (array.length % 2) {
    return array[half]
  }

  return (array[half - 1] + array[half]) / 2.0
}

export function toISOString(seconds: number) {
  return seconds && new Date(seconds * 1000).toISOString()
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function fetchURL(url: string, options?: RequestInit, retry?: number): Promise<any> {
  retry = retry === undefined ? 3 : retry
  try {
    let res = await fetch(url, options)
    return await res.json()
  } catch (err) {
    if (retry <= 0) {
      console.error('Fetch Error')
      throw err
    }
    await delay(2000)
    return await fetchURL(url, options, retry - 1)
  }
}


export async function fetchGraphQL(url: string, collection: string, where: string, orderBy: string, fields: string, first?: number) {
  const elements = []
  first = first || 1000
  while (true) {
    const skip = elements.length
    const query = `query {  ${collection} (first: ${first}, skip: ${skip}, where: { ${where} }, orderBy: "${orderBy}", orderDirection: desc) { ${fields} }}`

    const json = await fetchURL(url, {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ "query": query, "variables": null }),
      method: 'POST'
    })

    if (json.errors) {
      console.log(elements[skip - 1])
      throw Error('GraphQL Fetch Error ' + json.errors[0].message)
    } 
    if (!json.data[collection].length) break
    elements.push(...json.data[collection])
  }
  return elements
}

function removeDuplicates(data: any[], dataKey: string): any[] {
  const dataMap = {}
  for (const item of data) {
    dataMap[item[dataKey]] = item
  }

  return Object.values(dataMap)
}

export async function fetchGraphQLCondition(url: string, collection: string, fieldNameCondition: string, dataKey: string, fields: string, first?: number) {
  const elements = []
  first = first || 1000
  let lastField = 0

  while (true) {
    const query = `query {  ${collection} (first: ${first}, where: { ${fieldNameCondition}_gt: ${lastField} }, orderBy: "${fieldNameCondition}", orderDirection: asc) { ${fields} }}`

    const json = await fetchURL(url, {
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ "query": query, "variables": null }),
      method: 'POST'
    })

    if (json.errors) {
      throw Error('GraphQL Condition Fetch Error ' + json.errors[0].message)
    }
    if (!json.data[collection].length) break

    elements.push(...json.data[collection])
    lastField = elements[elements.length - 1][fieldNameCondition]
  }

  return removeDuplicates(elements, dataKey)
}

export function saveToFile(name: string, data: string) {
  if (!existsSync('./public')) mkdirSync('./public')
  const path = './public/' + name
  writeFileSync(path, data, 'utf8')
}

export function saveToJSON(name: string, data: any) {
  saveToFile(name, JSON.stringify(data))
  console.log("The JSON file has been saved.")
}

export async function saveToCSV(name: string, data: any, header: ObjectStringifierHeader) {
  if (!existsSync('./public')) mkdirSync('./public')
  const path = './public/' + name
  const csvWriter = createObjectCsvWriter({ path, header })
  await csvWriter.writeRecords(data)
  console.log('The CSV file has been saved.')
}

export function flattenArray<Type>(arr: Type[][]): Type[] {
  return arr.reduce((acc, val) => acc.concat(val), [])
}

export function splitArray<Type>(array: Type[], chunkSize: number) {
  return Array(Math.ceil(array.length / chunkSize)).fill(null).map(function (_, i) {
    return array.slice(i * chunkSize, i * chunkSize + chunkSize)
  })
}

export function setTransactionTag(tx: TransactionParsed) {
  const interactedWith = tx.interactedWith.toLowerCase()
  let tag = Tags[interactedWith]

  if (tx.type === TransferType.IN) {
    tag = Tags[tx.from] || tag
  }
  else if (tx.type === TransferType.OUT) {
    tag = Tags[tx.to] || tag
  }

  if (tag) {
    tx.tag = tag
  }
}

export function parseKPIs(kpis: KPI[]) {
  const result: any[] = []

  for (const kpi of kpis) {
    result.push(kpi.header)
    for (const row of kpi.rows) {
      result.push(row)
    }
    result.push([])
  }

  return result
}

export const tokenContracts: Record<string, string> = {
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': "MANA",
  '0x6b175474e89094c44da98b954eedeac495271d0f': "DAI",
  '0xdac17f958d2ee523a2206206994597c13d831ec7': "USDT",
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': "WETH",
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': "USDC",
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': "WBTC",
}

export const itemContracts: Record<string, string> = {
  '0x959e104e1a4db6317fa58f8295f586e1a978c297': "ESTATE fee",
  '0xf87e31492faf9a91b02ee0deaad50d51d56d5d4d': "LAND fee",
  '0x2a187453064356c898cae034eaed119e1663acb8': "NAME fee",
}

export const Tags: Record<string, string> = {
  ...tokenContracts, ...itemContracts, ...{
    '0xfe91c0c482e09600f2d1dbca10fd705bc6de60bc': "DAO Committee Member",
    '0xbef99f5f55cf7cdb3a70998c57061b7e1386a9b0': "DAO Committee Member",
    '0x521b0fef9cdcf250abaf8e7bc798cbe13fa98692': "DAO Committee Member",
    '0x59728544b08ab483533076417fbbb2fd0b17ce3a': "LooksRare",
    '0xc176761d388caf2f56cf03329d82e1e7c48ae09c': "Swap",
    '0xb3c839dbde6b96d37c56ee4f9dad3390d49310aa': "Swap",
    '0x1111111254fb6c44bac0bed2854e76f90643097d': "Swap",
    '0x27239549dd40e1d60f5b80b0c4196923745b1fd2': "Swap",
    '0x3058ef90929cb8180174d74c507176cca6835d73': "Swap",
    '0x220bda5c8994804ac96ebe4df184d25e5c2196d4': "Swap",
    '0x5f5207df64b0f7ed56bf0b61733d3be8795f4e5a': "Swap",
    '0x397ff1542f962076d0bfe58ea045ffa2d347aca0': "Swap",
    '0x1bec4db6c3bc499f3dbf289f5499c30d541fec97': "Swap",
    '0xc3d03e4f041fd4cd388c549ee2a29a9e5075882f': "Swap",
    '0x06da0fd433c1a5d7a4faa01111c044910a184553': "Swap",
    '0x11b1f53204d03e5529f09eb3091939e4fd8c9cf3': "Swap",
    '0x2ec255797fef7669fa243509b7a599121148ffba': "Swap",
    '0x6d51fdc0c57cbbff6dac4a565b35a17b88c6ceb5': "Swap",
    '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': "Swap",
    '0x8e5660b4ab70168b5a6feea0e0315cb49c8cd539': "Secondary Sale",
    '0x388fe75d523963c68f5741700403ca285bda5225': "Secondary Sale",
    '0xf9f68fc85cc9791d264477d1bb1aa649f022e9dc': "Secondary Sale",
    '0xcdd598d1588503e1609ae1e50cdb74473ffb0090': "Secondary Sale",
    '0xb9f46b3c2e79238e01f510a60846bf5dcc981bc3': "Secondary Sale",
    '0x1ea027314c055705ac09d9bc742e6eacc7a1ceb2': "Secondary Sale",
    '0x2a9da28bcbf97a8c008fd211f5127b860613922d': "Secondary Sale",
    '0x7ea4ff532f7c90422cbc4e63250f82acbc0e59b2': "Failed Grant",
    '0x7816095d41be0ef5875aa8046816ca64a506576a': "Failed Grant",
    '0xe5109a2af4da771beb0213fc9c794fb889ccfb92': "Failed Grant",
    '0x0babda04f62c549a09ef3313fe187f29c099ff3c': "Curation fee",
    '0x9d32aac179153a991e832550d9f96441ea27763a': "Curation fee",
    '0xc04528c14c8ffd84c7c1fb6719b4a89853035cdd': 'Wearable transfer fee', // ExclusiveMasksCollection
    '0xc1f4b0eea2bd6690930e6c66efd3e197d620b9c2': 'Wearable transfer fee', // Halloween2019Collection
    '0xc3af02c0fd486c8e9da5788b915d6fff3f049866': 'Wearable transfer fee', // Xmas2019Collection
    '0xf64dc33a192e056bb5f0e5049356a0498b502d50': 'Wearable transfer fee', // MCHCollection
    '0x32b7495895264ac9d0b12d32afd435453458b1c6': 'Wearable transfer fee', // CommunityContestCollection
    '0xd35147be6401dcb20811f2104c33de8e97ed6818': 'Wearable transfer fee', // DCLLaunchCollection
    '0x3163d2cfee3183f9874e2869942cc62649eeb004': 'Wearable transfer fee', // DCGCollection
    '0x201c3af8c471e5842428b74d1e7c0249adda2a92': 'Wearable transfer fee', // StaySafeCollection
    '0x6a99abebb48819d2abe92c5e4dc4f48dc09a3ee8': 'Wearable transfer fee', // Moonshot2020Collection
    '0x1e1d4e6262787c8a8783a37fee698bd42aa42bec': 'Wearable transfer fee', // DappcraftMoonminerCollection
    '0xbf53c33235cbfc22cef5a61a83484b86342679c5': 'Wearable transfer fee', // DGSummer2020Collection
    '0x75a3752579dc2d63ca229eebbe3537fbabf85a12': 'Wearable transfer fee', // PMOuttathisworldCollection
    '0x574f64ac2e7215cba9752b85fc73030f35166bc0': 'Wearable transfer fee', // DgtbleHeadspaceCollection
    '0x34ed0aa248f60f54dd32fbc9883d6137a491f4f3': 'Wearable transfer fee', // WonderzoneMeteorchaserCollection
    '0xa8ee490e4c4da48cc1653502c1a77479d4d818de': 'Wearable transfer fee', // BinanceUsCollection
    '0xfeb52cbf71b9adac957c6f948a6cf9980ac8c907': 'Wearable transfer fee', // Halloween2020Collection
    '0xecf073f91101ce5628669c487aee8f5822a101b1': 'Wearable transfer fee', // Xmas2020Collection
    '0x480a0f4e360e8964e68858dd231c2922f1df45ef': 'Wearable transfer fee', // TECH TRIBAL
    '0xc3ca6c364b854fd0a653a43f8344f8c22ddfdd26': 'Wearable transfer fee', // CZ MERCENARY MTZ
    '0x4c290f486bae507719c562b6b524bdb71a2570c9': 'Wearable transfer fee', // ATARI LAUNCH
  }
}