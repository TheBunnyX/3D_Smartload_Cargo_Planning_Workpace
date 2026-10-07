import type { CargoItem, OptimizationMode, OptimizationResult, PackedBox, StrategySummary, Truck } from '../types'
import { modes, validateInputs } from '../lib/project'

const volume=(a:number,b:number,c:number)=>a*b*c
const GRAVITY=9.80665
type Size=[number,number,number]
type Placement={x:number;y:number;z:number;size:Size}

const occupiedEnvelope=(placement:Placement,boxes:PackedBox[])=>{
  const envelope=boxes.reduce((max,box)=>({
    x:Math.max(max.x,box.position.x+box.dimensions[0]/2),
    y:Math.max(max.y,box.position.y+box.dimensions[2]/2),
    z:Math.max(max.z,box.position.z+box.dimensions[1]/2),
  }),{x:0,y:0,z:0})
  const x=Math.max(envelope.x,placement.x+placement.size[0]), y=Math.max(envelope.y,placement.y+placement.size[2]), z=Math.max(envelope.z,placement.z+placement.size[1])
  return {footprint:x*z,volume:x*y*z}
}

const candidatePlacements=(boxes:PackedBox[])=>{
  const candidates:Placement[]=[{x:0,y:0,z:0,size:[0,0,0]}]
  const xEdges=new Set<number>([0]), zEdges=new Set<number>([0])
  boxes.forEach(box=>{
    const [length,width,height]=box.dimensions
    const left=box.position.x-length/2, front=box.position.z-width/2, bottom=box.position.y-height/2
    xEdges.add(left);xEdges.add(left+length);zEdges.add(front);zEdges.add(front+width)
    candidates.push({x:left+length,y:bottom,z:front,size:[0,0,0]},{x:left,y:bottom+height,z:front,size:[0,0,0]},{x:left,y:bottom,z:front+width,size:[0,0,0]})
  })
  for(const x of xEdges)for(const z of zEdges)candidates.push({x,y:0,z,size:[0,0,0]})
  const seen=new Set<string>()
  return candidates.filter(point=>{const key=`${point.x}|${point.y}|${point.z}`;if(seen.has(key))return false;seen.add(key);return true})
}

const overlaps=(a:Placement,b:Placement)=>
  a.x < b.x+b.size[0]-1e-8 && a.x+a.size[0] > b.x+1e-8 &&
  a.y < b.y+b.size[2]-1e-8 && a.y+a.size[2] > b.y+1e-8 &&
  a.z < b.z+b.size[1]-1e-8 && a.z+a.size[1] > b.z+1e-8

/** True when `box` sits between `placement` and the rear door (the +x end of the vehicle). */
const blocksDoor=(placement:Placement,box:PackedBox)=>{
  const [length,width,height]=box.dimensions
  const left=box.position.x-length/2, bottom=box.position.y-height/2, front=box.position.z-width/2
  return left>=placement.x+placement.size[0]-1e-8&&
    placement.y<bottom+height-1e-8&&placement.y+placement.size[2]>bottom+1e-8&&
    placement.z<front+width-1e-8&&placement.z+placement.size[1]>front+1e-8
}

const orientations=(item:CargoItem):Size[]=>{
  const base:Size=[item.length,item.width,item.height]
  if(!item.rotate || item.length===item.width) return [base]
  return [base,[item.width,item.length,item.height]]
}

const supportsFor=(placement:Placement,boxes:PackedBox[])=>{
  if(placement.y===0)return []
  return boxes.filter(box=>{
    const [l,w,h]=box.dimensions
    const left=box.position.x-l/2, front=box.position.z-w/2, top=box.position.y+h/2
    const overlapsFootprint=placement.x<left+l&&placement.x+placement.size[0]>left&&placement.z<front+w&&placement.z+placement.size[1]>front
    return Math.abs(top-placement.y)<1e-8&&overlapsFootprint&&box.stackable
  })
}

const supportContactArea=(placement:Placement,box:PackedBox)=>{
  const [length,width]=box.dimensions
  const left=box.position.x-length/2, front=box.position.z-width/2
  const overlapLength=Math.max(0,Math.min(placement.x+placement.size[0],left+length)-Math.max(placement.x,left))
  const overlapWidth=Math.max(0,Math.min(placement.z+placement.size[1],front+width)-Math.max(placement.z,front))
  return overlapLength*overlapWidth
}

const isStable=(placement:Placement,supports:PackedBox[])=>{
  if(placement.y===0)return true
  // Require the complete base to be supported; do not approve large overhangs.
  if(supports.reduce((area,box)=>area+supportContactArea(placement,box),0)<placement.size[0]*placement.size[1]-1e-8)return false
  const centerX=placement.x+placement.size[0]/2, centerZ=placement.z+placement.size[1]/2
  return supports.some(box=>{
    const [l,w]=box.dimensions
    return centerX>=box.position.x-l/2&&centerX<=box.position.x+l/2&&centerZ>=box.position.z-w/2&&centerZ<=box.position.z+w/2
  })
}

/** A box may be reached through more than one support branch. Accumulate all
 * incoming load before checking a support tree's capacity. */
const collectLoadDeltas=(boxes:PackedBox[],boxId:string,addedLoad:number,deltas:Map<string,number>):boolean=>{
  const box=boxes.find(candidate=>candidate.id===boxId)
  if(!box)return false
  deltas.set(boxId,(deltas.get(boxId)??0)+addedLoad)
  const placement:Placement={x:box.position.x-box.dimensions[0]/2,y:box.position.y-box.dimensions[2]/2,z:box.position.z-box.dimensions[1]/2,size:box.dimensions}
  const supports=boxes.filter(candidate=>box.supportedBy.includes(candidate.id))
  const area=supports.reduce((sum,support)=>sum+supportContactArea(placement,support),0)
  return supports.every(support=>collectLoadDeltas(boxes,support.id,addedLoad*supportContactArea(placement,support)/area,deltas))
}

const canApplyDeltas=(boxes:PackedBox[],deltas:Map<string,number>)=>
  [...deltas].every(([id,addedLoad])=>{
    const box=boxes.find(candidate=>candidate.id===id)
    return !!box&&box.loadAbove+addedLoad<=box.maxStackWeight+1e-8
  })

const applyDeltas=(boxes:PackedBox[],deltas:Map<string,number>)=>{
  deltas.forEach((addedLoad,id)=>{
    const box=boxes.find(candidate=>candidate.id===id)
    if(!box)return
    box.loadAbove+=addedLoad
    box.totalLoad+=addedLoad
    box.gravitationalForce=box.totalLoad*GRAVITY
  })
}

type Unit=CargoItem&{instance:number}
const unitVolume=(unit:Unit)=>volume(unit.length,unit.width,unit.height)
const priorityRank={High:0,Medium:1,Low:2}

function pack(truck:Truck, expanded:Unit[], compact:boolean, useWeightLimit:boolean){
  const boxes:PackedBox[]=[]; const unloaded:string[]=[]; let totalWeight=0
  const limits=[Math.max(0,truck.length),Math.max(0,truck.width),Math.max(0,truck.height)]

  expanded.forEach(item=>{
    let best:Placement|undefined; let bestFootprint=Infinity; let bestEnvelope=Infinity
    let bestSupports:PackedBox[]=[]
    let bestLoadDeltas=new Map<string,number>()
    const overPayload=useWeightLimit&&totalWeight+item.weight>Math.max(0,truck.maxWeight)+1e-8
    const candidates=overPayload?[]:candidatePlacements(boxes)
    for(const dims of orientations(item)) for(const point of candidates){
      const placement={x:point.x,y:point.y,z:point.z,size:dims}
      if(placement.x<0||placement.y<0||placement.z<0||placement.x+dims[0]>limits[0]+1e-8||placement.y+dims[2]>limits[2]+1e-8||placement.z+dims[1]>limits[1]+1e-8) continue
      if(boxes.some(box=>overlaps(placement,{x:box.position.x-box.dimensions[0]/2,y:box.position.y-box.dimensions[2]/2,z:box.position.z-box.dimensions[1]/2,size:box.dimensions}))) continue
      // Cargo for an earlier stop must not be boxed in: nothing for a later stop may stand between it and the rear door.
      if(boxes.some(box=>box.stop>item.stop&&blocksDoor(placement,box))) continue
      const supports=supportsFor(placement,boxes)
      if(!isStable(placement,supports)) continue
       const loadDeltas=new Map<string,number>()
       const totalSupportArea=supports.reduce((sum,box)=>sum+supportContactArea(placement,box),0)
       if(supports.length&&totalSupportArea===0) continue
       if(!supports.every(box=>collectLoadDeltas(boxes,box.id,item.weight*supportContactArea(placement,box)/totalSupportArea,loadDeltas))||!canApplyDeltas(boxes,loadDeltas)) continue
       const compactness=compact?occupiedEnvelope(placement,boxes):undefined
       const isBetter=compact
         ? compactness!.footprint<bestFootprint-1e-8||(Math.abs(compactness!.footprint-bestFootprint)<1e-8&&(compactness!.volume<bestEnvelope-1e-8||(Math.abs(compactness!.volume-bestEnvelope)<1e-8&&(!best||placement.y<best.y||(placement.y===best.y&&placement.z<best.z)||(placement.y===best.y&&placement.z===best.z&&placement.x<best.x)))))
         : !best||placement.y<best.y||(placement.y===best.y&&placement.z<best.z)||(placement.y===best.y&&placement.z===best.z&&placement.x<best.x)
       if(isBetter){best=placement;bestFootprint=compactness?.footprint??bestFootprint;bestEnvelope=compactness?.volume??bestEnvelope;bestSupports=supports;bestLoadDeltas=loadDeltas}
    }
    if(best){
      const [l,w,h]=best.size
      const id=`${item.id}-${String(item.instance).padStart(2,'0')}`
       boxes.push({id,cargoId:item.id,name:item.name,dimensions:best.size,weight:item.weight,maxStackWeight:item.maxStackWeight,color:item.color,position:{x:best.x+l/2,y:best.y+h/2,z:best.z+w/2},priority:item.priority,stop:item.stop,level:bestSupports.length?Math.max(...bestSupports.map(box=>box.level))+1:1,stackable:item.stackable,supportedBy:bestSupports.map(box=>box.id),loadAbove:0,totalLoad:item.weight,gravitationalForce:item.weight*GRAVITY})
       applyDeltas(boxes,bestLoadDeltas)
      totalWeight+=item.weight
    } else unloaded.push(`${item.id}-${String(item.instance).padStart(2,'0')}`)
  })
  return {boxes,unloaded,totalWeight}
}

export function optimize(truck:Truck, cargo:CargoItem[], options:{mode?:OptimizationMode}={}):OptimizationResult {
  const errors=validateInputs(truck,cargo)
  if(errors.length)throw new Error(errors[0])
  const mode=options.mode??'weight-aware'
  const useWeightLimit=mode!=='space-only'
  const units:Unit[]=cargo.flatMap(item=>Array.from({length:Math.max(0,Math.floor(item.quantity))},(_,i)=>({...item,instance:i+1})))
  const byPriority=(a:Unit,b:Unit)=>priorityRank[a.priority]-priorityRank[b.priority]||unitVolume(b)-unitVolume(a)||b.weight-a.weight
  // No single order loads the most units for every shipment: small-first can leave large
  // units without a full base to rest on. maximize-items keeps the best of several attempts,
  // including the ones the other strategies use, so it never loads fewer units than they do.
  const attempts:[order:(a:Unit,b:Unit)=>number,compact:boolean][]=mode==='maximize-items'
    ? [[(a,b)=>unitVolume(a)-unitVolume(b)||a.weight-b.weight,false],
       [(a,b)=>a.weight-b.weight||unitVolume(a)-unitVolume(b),false],
       [(a,b)=>unitVolume(b)-unitVolume(a)||a.weight-b.weight,false],
       [(a,b)=>b.length*b.width-a.length*a.width||b.height-a.height,false],
       [byPriority,false],
       [byPriority,true]]
    : [[byPriority,mode==='compact-stack']]
  // Later stops are loaded first so they end up deepest in the vehicle.
  const inOrder=(order:(a:Unit,b:Unit)=>number)=>[...units].sort((a,b)=>b.stop-a.stop||order(a,b))
  let packed=pack(truck,inOrder(attempts[0][0]),attempts[0][1],useWeightLimit)
  for(const [order,compact] of attempts.slice(1)){
    if(!packed.unloaded.length)break
    const attempt=pack(truck,inOrder(order),compact,useWeightLimit)
    if(attempt.boxes.length>packed.boxes.length)packed=attempt
  }
  const {boxes,unloaded,totalWeight}=packed
  // Center the load across the width so a compact block does not sit against one wall.
  const sideGap=(truck.width-Math.max(0,...boxes.map(box=>box.position.z+box.dimensions[1]/2)))/2
  if(sideGap>1e-8)boxes.forEach(box=>{box.position.z+=sideGap})
  const used=boxes.reduce((sum,b)=>sum+volume(...b.dimensions),0), total=units.length, vol=volume(truck.length,truck.width,truck.height)
  const cog=boxes.reduce((p,b)=>({x:p.x+b.position.x*b.weight,y:p.y+b.position.y*b.weight,z:p.z+b.position.z*b.weight}),{x:0,y:0,z:0}); const weight=totalWeight||1
  const balanceWeight=boxes.reduce((totals,b)=>{
    const frontFraction=Math.max(0,Math.min(1,(truck.length/2-(b.position.x-b.dimensions[0]/2))/b.dimensions[0]))
    const leftFraction=Math.max(0,Math.min(1,(truck.width/2-(b.position.z-b.dimensions[1]/2))/b.dimensions[1]))
    totals.front+=b.weight*frontFraction;totals.rear+=b.weight*(1-frontFraction)
    totals.left+=b.weight*leftFraction;totals.right+=b.weight*(1-leftFraction)
    return totals
  },{front:0,rear:0,left:0,right:0})
  const balance={front:balanceWeight.front/weight*100,rear:balanceWeight.rear/weight*100,left:balanceWeight.left/weight*100,right:balanceWeight.right/weight*100,variance:Math.abs(balanceWeight.left-balanceWeight.right)/weight*100}
  const spaceUtil=vol>0?used/vol*100:0, weightUtil=truck.maxWeight>0?totalWeight/truck.maxWeight*100:0
  const placementRate=total?boxes.length/total*100:0
  const balanceScore=Math.max(0,100-balance.variance*2)
  const score=total?Math.round(placementRate*.4+spaceUtil*.2+(useWeightLimit?weightUtil*.15:0)+balanceScore*(useWeightLimit ? .25 : .4)):0
  // Static beam model: the cargo mass acts at its center of gravity and is shared by the two axles.
  const axles=truck.axles
  const rearAxle=axles?totalWeight*(cog.x/weight-axles.front)/(axles.rear-axles.front):0
  const axle=axles?{front:totalWeight-rearAxle,rear:rearAxle,frontLimit:axles.frontLimit,rearLimit:axles.rearLimit}:undefined
  return {boxes,unloaded,metrics:{volume:used,totalWeight,spaceUtil,weightUtil,score,loaded:boxes.length,total,cog:{x:cog.x/weight,y:cog.y/weight,z:cog.z/weight},balance,...(axle?{axle}:{})}}
}

/** Run every strategy on the same shipment so their results can be compared side by side. */
export function compareStrategies(truck:Truck, cargo:CargoItem[]):StrategySummary[] {
  return modes.map(mode=>({mode,metrics:optimize(truck,cargo,{mode}).metrics}))
}
