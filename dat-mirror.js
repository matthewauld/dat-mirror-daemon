const  {DatArchive} = require('dat-sdk/auto')
DEFAULT_REFRESH = 6000


module.exports = class DatMirror{
	constructor(instructionDat, monitorDat, config){
		this.config = config
		if (!this.config)
			this.config = {}

		this.monitorDatKey = monitorDat

		this.instructionPath =  '/dat-mirror/config.json'
		console.log('instructionPath', this.instructionPath)
		this.instructions = null
		this.instructionDatKey = instructionDat
		this.dats = new Map()
		this.refresh = DEFAULT_REFRESH
		this._loadPromise = Promise.resolve().then(async()=>{
			this.instructionDat = await DatArchive.load(this.instructionDatKey,{sparse:false,persist:true})
			if(!this.monitorDatKey){
				this.monitorDat = await DatArchive.create(this.monitorDatKey,{sparse:false,persist:true})
			} else {
				this.monitorDat = await DatArchive.load(this.monitorDatKey,{sparse:false,persist:true})
			}
			this.instructionEvent = this.instructionDat.watch([this.instructionPath])
			this.instructionEvent.addEventListener('changed',({path})=> this.updateInstructions())
			this.monitorRefreshTimer = setInterval(async() =>{return this.updateInfo()} , this.refresh)
			this.updateInstructions()
		})
	}


	async updateInstructions(){
		await this._loadPromise
		const instructions = await this.instructionDat.readFile(this.instructionPath,'utf8')
		try{
			this.instructions = JSON.parse(instructions)
		} catch (e){
			this.instructions = {targets: [],error:e}
		}


		//add dats that need to be added
		await Promise.all(this.instructions.targets.map(target=>{return this.addArchive(target)}))

		//remove dats that need to be removed
		const requiredDats = this.instructions.targets.map(target =>{return target.key})
		const currentDats = this.dats.keys()
		//TODO: there must be a better way to do this...
		await Promise.all(Array.from(currentDats).map(target=>{return this.removeArchive(target,requiredDats)}))

	}


	async addArchive(target){
		if(!this.dats.has(target.key)){
			try {
				const newArchive = await DatArchive.load(target.key,{sparse:false,persist:true})
				this.dats.set(target.key,{'archive':newArchive})
				console.log("Adding archive new: ", target.key)

			} catch(e){
				this.dats.set(target.key,{'error':e})
				console.error("Error: could not load archive",target.key)
			}

		}
}


	async removeArchive(target, required){
		if (!required.includes(target)){
			console.log("Removing archive: ", target)
			this.dats.delete(target)
			await DatArchive.unlink(target)
		}
	}

	async updateInfo(){
		for (let [key,value] of this.dats){
			//can these be executed concurrently? Does it matter?
			if(value.archive)
				value.info = await value.archive.getInfo()
		}
		const archives = Array.from(this.dats).map((entry)=>{
			let [key,value] = entry
			return value.info?value.info:{url:key}
		})
		try{
			await this.monitorDat.writeFile('/monitor-dat.json',JSON.stringify({archives: archives}))
		} catch(e){
			console.error("Could not write to monitorDat")
		}

	}
}
