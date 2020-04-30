const  {DatArchive} = require('dat-sdk/auto')


test = async() =>{
  let a = await DatArchive.load('dat://beakerbrowser.com/')
  await a.download('/')
  console.log(await a.getInfo())
}

test()
