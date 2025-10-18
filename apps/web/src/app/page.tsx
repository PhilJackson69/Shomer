import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              🛡️ Shomer v1
            </h1>
            <p className="mt-2 text-gray-600">
              AI-powered community safety platform
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">
            Welcome to Shomer
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
            Monitor digital threats, report physical incidents, and keep your community safe with AI-powered detection and real-time alerts.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                Dashboard
              </h3>
              <p className="text-gray-600 mb-6">
                View real-time incidents, monitor digital threats from Reddit, and track community reports on an interactive map.
              </p>
              <Link
                href="/dashboard"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
              >
                View Dashboard
              </Link>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                Report Incident
              </h3>
              <p className="text-gray-600 mb-6">
                Submit physical incident reports to help keep your community safe. All reports are confidential and secure.
              </p>
              <Link
                href="/report"
                className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
              >
                Submit Report
              </Link>
            </div>
          </div>

          <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              Features
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🤖</div>
                <h4 className="font-semibold text-gray-900 mb-2">AI Detection</h4>
                <p className="text-sm text-gray-600">
                  Advanced NLP models detect antisemitic and violent content automatically
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🗺️</div>
                <h4 className="font-semibold text-gray-900 mb-2">Interactive Map</h4>
                <p className="text-sm text-gray-600">
                  Visualize incidents on a real-time map with severity indicators
                </p>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🚨</div>
                <h4 className="font-semibold text-gray-900 mb-2">Real-time Alerts</h4>
                <p className="text-sm text-gray-600">
                  Instant Slack notifications for high-severity incidents
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
