
class EventBus {
	constructor() {
		this.eventTargets = {};
	}

	publish(eventName) {
		const eventTargets = this.eventTargets[eventName];

		if (!eventTargets) return console.warn(eventName + " not found!");

		for (let target of eventTargets) {
			target.emit(eventName, null, false);
		}
	}

	subscribe(eventName, target) {
		if (!this.eventTargets[eventName]) {
			this.eventTargets[eventName] = [];
		}

		this.eventTargets[eventName].push(target);
	}

	unSubscribe(eventName, target) {

		if (!this.eventTargets.hasOwnProperty(eventName))
			return

		const index = this.eventTargets[eventName].indexOf(target);
		if (index > -1) {
			this.eventTargets[eventName].splice(index, 1);
			if (this.eventTargets[eventName].length == 0) {
				delete this.eventTargets[eventName]
			}
		}

	}
}

let eventBus = new EventBus()

export default eventBus