import Observation
import SwiftUI

struct RiderShellView: View {
    @Bindable var appModel: AppModel

    var body: some View {
        NavigationStack {
            ShuttleHome(appModel: appModel)
        }
    }
}
