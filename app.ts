// interfaces
interface IEvent {
    type(): string;
    machineId(): string;
}

interface ISubscriber {
    handle(event: IEvent): void;
}

interface IPublishSubscribeService {
    publish(event: IEvent): void;
    subscribe(type: string, handler: ISubscriber): void;
    unsubscribe(type: string, handler: ISubscriber): void;
}


// implementations
class MachineSaleEvent implements IEvent {
    constructor(private readonly _sold: number, private readonly _machineId: string) { }

    machineId(): string {
        return this._machineId;
    }

    getSoldQuantity(): number {
        return this._sold
    }

    type(): string {
        return 'sale';
    }
}

class MachineRefillEvent implements IEvent {
    constructor(private readonly _refill: number, private readonly _machineId: string) { }

    machineId(): string {
        return this._machineId;
    }

    getRefillQuantity(): number {
        return this._refill
    }

    type(): string {
        return 'refill';
    }
}

class LowStockWarningEvent implements IEvent {
    constructor(private readonly _machineId: string) { }

    machineId(): string {
        return this._machineId;
    }

    type(): string {
        return 'lowStockWarning';
    }
}

class StockLevelOkEvent implements IEvent {
    constructor(private readonly _machineId: string) { }

    machineId(): string {
        return this._machineId;
    }

    type(): string {
        return 'stockLevelOk';
    }
}

class MachineSaleSubscriber implements ISubscriber {
    public machines: Machine[];

    constructor(machines: Machine[]) {
        this.machines = machines;
    }

    handle(event: MachineSaleEvent): void {
        const machine = this.machines.find(m => m.id === event.machineId());

        if (machine) {
            machine.stockLevel -= event.getSoldQuantity();
            console.log(`Machine ${machine.id} sold an item. New stock: ${machine.stockLevel}`);

            if (machine.stockLevel < 3) {
                console.log(`Machine ${machine.id} is low on stock. Stock: ${machine.stockLevel}`);
                pubSubService.publish(new LowStockWarningEvent(machine.id));
            }
        }
    }
}

class MachineRefillSubscriber implements ISubscriber {
    public machines: Machine[];

    constructor(machines: Machine[]) {
        this.machines = machines;
    }

    handle(event: MachineRefillEvent): void {
        const machine = this.machines.find(m => m.id === event.machineId());

        if (machine) {
            machine.stockLevel += event.getRefillQuantity();
            console.log(`Machine ${machine.id} refilled. New stock: ${machine.stockLevel}`);

            if (machine.stockLevel >= 3) {
                console.log(`Machine ${machine.id} stock is ok. Stock: ${machine.stockLevel}`);
                pubSubService.publish(new StockLevelOkEvent(machine.id));
            }
        }
    }
}

class StockWarningSubscriber implements ISubscriber {
    private warningStates: Map<string, boolean> = new Map();

    handle(event: IEvent): void {
        if (event instanceof LowStockWarningEvent) {
            if (!this.warningStates.get(event.machineId())) {
                console.log(`Low stock warning for machine ${event.machineId()}`);
                this.warningStates.set(event.machineId(), true);
            }
        } else if (event instanceof StockLevelOkEvent) {
            if (this.warningStates.get(event.machineId())) {
                console.log(`Stock level OK for machine ${event.machineId()}`);
                this.warningStates.set(event.machineId(), false);
            }
        }
    }
}


// objects
class Machine {
    public stockLevel = 10;
    public id: string;

    constructor(id: string) {
        this.id = id;
    }
}


// helpers
const randomMachine = (): string => {
    const random = Math.random() * 3;
    if (random < 1) {
        return '001';
    } else if (random < 2) {
        return '002';
    }
    return '003';

}

const eventGenerator = (): IEvent => {
    const random = Math.random();
    if (random < 0.5) {
        const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
        return new MachineSaleEvent(saleQty, randomMachine());
    }
    const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
    return new MachineRefillEvent(refillQty, randomMachine());
}

class PubSubService implements IPublishSubscribeService {
    private subscribers: Map<string, Set<ISubscriber>> = new Map();
    private eventQueue: IEvent[] = [];
    private isProcessing = false;

    publish(event: IEvent): void {
        this.eventQueue.push(event);

        if (!this.isProcessing) {
            this.processEventQueue();
        }
    }

    subscribe(type: string, handler: ISubscriber): void {
        if (!this.subscribers.has(type)) {
            this.subscribers.set(type, new Set());
        }
        this.subscribers.get(type)!.add(handler);
    }

    unsubscribe(type: string, handler: ISubscriber): void {
        if (this.subscribers.has(type)) {
            this.subscribers.get(type)!.delete(handler);
        }
    }

    private processEventQueue(): void {
        this.isProcessing = true;
        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;
            const eventSubscribers = this.subscribers.get(event.type());

            if (eventSubscribers) {
                eventSubscribers.forEach(subscriber => { subscriber.handle(event) });
            }
        }
        this.isProcessing = false;
    }
}


const pubSubService = new PubSubService();

const normalCase = async () => {
    const machines: Machine[] = [new Machine('001'), new Machine('002'), new Machine('003')];

    const saleSubscriber = new MachineSaleSubscriber(machines);
    const refillSubscriber = new MachineRefillSubscriber(machines);
    const stockWarningSubscriber = new StockWarningSubscriber();

    pubSubService.subscribe('sale', saleSubscriber);
    pubSubService.subscribe('refill', refillSubscriber);
    pubSubService.subscribe('lowStockWarning', stockWarningSubscriber);
    pubSubService.subscribe('stockLevelOk', stockWarningSubscriber);

    // create 5 random events
    const events = [1, 2, 3, 4, 5,].map(i => eventGenerator());

    events.map(event => pubSubService.publish(event));

    // log the machines
    console.log("Final Machines:", machines);
}

// program
(async () => {
    await normalCase();
})();