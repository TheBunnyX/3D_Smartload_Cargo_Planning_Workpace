import type { CargoItem, Truck } from '../types'
export const demoTruck: Truck = { name: '6-Wheel Truck', length: 6.2, width: 2.3, height: 2.4, maxWeight: 8000 }
export const demoCargo: CargoItem[] = [
  { id:'BX-001', name:'Standard pallets', length:1.2,width:1,height:1,weight:250,maxStackWeight:750,quantity:6,priority:'High',color:'#4f79d9',rotate:true,stackable:true,stop:1 },
  { id:'BX-002', name:'Machine crates', length:1,width:.8,height:.8,weight:180,maxStackWeight:360,quantity:4,priority:'Medium',color:'#db7a56',rotate:true,stackable:true,stop:1 },
  { id:'BX-003', name:'Electronic cartons', length:.6,width:.4,height:.35,weight:25,maxStackWeight:50,quantity:8,priority:'Low',color:'#8966c5',rotate:true,stackable:true,stop:1 }
]
