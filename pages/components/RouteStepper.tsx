import { Steps } from 'antd-mobile'
import type { Nullable, Station } from '../../lib/types'

interface RouteStepperProps {
  stations?: Station[]
  myStationId?: Nullable<string>
}

export default function RouteStepper({
  stations = [],
  myStationId = null,
}: RouteStepperProps) {
  const myIndex = stations.findIndex((station) => station.id === myStationId)

  return (
    <Steps
      direction='vertical'
      current={myIndex >= 0 ? myIndex : undefined}
      style={{ '--title-font-size': '14px', '--description-font-size': '12px' }}
    >
      {stations.map((station, index) => (
        <Steps.Step
          key={station.id}
          title={station.name}
          description={
            station.pickup_time
              ? `${station.pickup_time}${station.notes ? ` · ${station.notes}` : ''}`
              : station.notes ?? undefined
          }
          status={station.id === myStationId ? 'process' : index < myIndex ? 'finish' : 'wait'}
        />
      ))}
    </Steps>
  )
}
