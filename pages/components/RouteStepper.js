import { Steps } from 'antd-mobile'

export default function RouteStepper({ stations = [], myStationId = null }) {
  const myIndex = stations.findIndex((s) => s.id === myStationId)

  return (
    <Steps
      direction="vertical"
      current={myIndex >= 0 ? myIndex : undefined}
      style={{ '--title-font-size': '14px', '--description-font-size': '12px' }}
    >
      {stations.map((station, i) => (
        <Steps.Step
          key={station.id}
          title={station.name}
          description={
            station.pickup_time
              ? `${station.pickup_time}${station.notes ? ` · ${station.notes}` : ''}`
              : station.notes ?? undefined
          }
          status={
            station.id === myStationId
              ? 'process'
              : i < myIndex
              ? 'finish'
              : 'wait'
          }
        />
      ))}
    </Steps>
  )
}
