import SwiftUI

struct SearchStopRow: View {
    let place: PlaceSummary
    let distance: String?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: place.isTerminal ? "bus.fill" : "mappin.circle.fill")
                .foregroundStyle(place.isTerminal ? ShuttleTheme.success : ShuttleTheme.primary)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(place.name)
                    .font(.body)
                    .foregroundStyle(ShuttleTheme.text)
                    .lineLimit(1)
                if let distance {
                    Text(distance)
                        .font(.caption)
                        .foregroundStyle(ShuttleTheme.secondaryText)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(ShuttleTheme.secondaryText)
        }
        .padding(.vertical, 2)
    }
}
