import { Canvas } from '@react-three/fiber'
import { Edges, Grid, Html, OrbitControls } from '@react-three/drei'
import type { PackedBox, Truck, Vec3 } from '../types'

export default function CargoScene({ truck, boxes, selected, onSelect, wire, showMass, view, cog, showCog }: {
  truck: Truck; boxes: PackedBox[]; selected?: string; onSelect: (id: string) => void;
  wire: boolean; showMass: boolean; view: string; cog: Vec3; showCog: boolean
}) {
  const span = Math.max(truck.length, truck.width, truck.height, 2)
  const positions: Record<string, [number, number, number]> = { Perspective: [span * 1.3, span, span * 1.3], Top: [0, span * 2, 0.001], Front: [-span * 2, 0, 0], Side: [0, 0, span * 2] }
  return <Canvas key={view + span} camera={{ position: positions[view], fov: 42, near: 0.01, far: Math.max(200, span * 10) }} onPointerMissed={() => onSelect('')}>
    <color attach="background" args={['#f2f5fa']}/><ambientLight intensity={1.5}/><directionalLight position={[5, 10, 6]} intensity={2}/>
    <group position={[-truck.length / 2, -truck.height / 2, -truck.width / 2]}>
      <Grid position={[truck.length / 2, -0.005, truck.width / 2]} args={[truck.length * 1.7, truck.width * 2]} cellSize={0.5} cellThickness={0.5} cellColor="#c9d3e3" sectionSize={1} sectionColor="#b4c1d5" fadeDistance={span * 4}/>
      <mesh position={[truck.length / 2, truck.height / 2, truck.width / 2]} raycast={() => {}}><boxGeometry args={[truck.length, truck.height, truck.width]}/><meshBasicMaterial color="#7088ab" transparent opacity={0.035} depthWrite={false}/><Edges color="#899dbb"/></mesh>
      {boxes.map(box => <mesh key={box.id} position={[box.position.x, box.position.y, box.position.z]} onClick={event => { event.stopPropagation(); onSelect(box.id) }}>
        <boxGeometry args={[box.dimensions[0], box.dimensions[2], box.dimensions[1]]}/><meshStandardMaterial color={box.color} roughness={0.7} wireframe={wire} emissive={selected === box.id ? box.color : '#000000'} emissiveIntensity={0.18}/><Edges color={selected === box.id ? '#152440' : '#ffffff'} linewidth={selected === box.id ? 2 : 1}/>
        {showMass && <Html position={[0, box.dimensions[2] / 2 + 0.04, 0]} center style={{ pointerEvents: 'none' }}><span className="mass-label">{box.weight} kg</span></Html>}
      </mesh>)}
      {showCog && <mesh position={[cog.x, cog.y, cog.z]} raycast={() => {}} renderOrder={100}><sphereGeometry args={[span * 0.016, 16, 16]}/><meshBasicMaterial color="#ed7a4a" depthTest={false}/></mesh>}
    </group><OrbitControls makeDefault enableDamping minDistance={span * 0.2} maxDistance={span * 5}/>
  </Canvas>
}
