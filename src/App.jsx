import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { createEvent, supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-solid';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { SolidMarkdown } from 'solid-markdown';

function App() {
  const [user, setUser] = createSignal(null);
  const [currentPage, setCurrentPage] = createSignal('login');

  const [famousPerson, setFamousPerson] = createSignal('');
  const [currentQuestion, setCurrentQuestion] = createSignal('');
  const [conversation, setConversation] = createSignal([]);
  const [loading, setLoading] = createSignal(false);
  const [weatherCity, setWeatherCity] = createSignal('');
  const [showWeatherModal, setShowWeatherModal] = createSignal(false);

  const checkUserSignedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      setCurrentPage('famousPersonSelection')
    }
  }

  onMount(() => {
    checkUserSignedIn();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser(session.user)
        setCurrentPage('famousPersonSelection')
      } else {
        setUser(null)
        setCurrentPage('login')
      }
    })

    onCleanup(() => {
      subscription.unsubscribe()
    })
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('login');
  };

  const handleStartConversation = () => {
    if (famousPerson().trim() !== '') {
      setConversation([]);
      setCurrentPage('conversation');
    }
  };

  const handleAskQuestion = async () => {
    if (currentQuestion().trim() === '') return;

    setLoading(true);

    const updatedConversation = [...conversation(), { role: 'user', content: currentQuestion() }];
    setConversation(updatedConversation);

    const conversationHistory = updatedConversation
      .map((msg) => (msg.role === 'user' ? `You: ${msg.content}` : `${famousPerson()}: ${msg.content}`))
      .join('\n');

    const prompt = `You are ${famousPerson()}. Answer the user's questions in the manner that ${famousPerson()} would. Here is the conversation so far:\n${conversationHistory}\n${famousPerson()}:`;

    try {
      const result = await createEvent('chatgpt_request', {
        prompt: prompt,
        response_type: 'text',
      });

      setConversation([...updatedConversation, { role: 'assistant', content: result }]);
      setCurrentQuestion('');
    } catch (error) {
      console.error('Error getting response:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = () => {
    setFamousPerson('');
    setCurrentQuestion('');
    setConversation([]);
    setCurrentPage('famousPersonSelection');
  };

  const handleQuit = () => {
    setCurrentQuestion('');
    setConversation([]);
    setCurrentPage('homePage');
  };

  const handleGetWeather = async () => {
    if (weatherCity().trim() === '') return;

    setLoading(true);
    setShowWeatherModal(false);

    try {
      const result = await createEvent('call_api', {
        api_id: 'ea764266-2a18-41c9-b7b0-dac80fed3797',
        instructions: `Get the current weather for ${weatherCity()}`
      });

      if (result) {
        const weatherInfo = `Current weather in ${weatherCity()}:\nTemperature: ${result.temp}°C\nHumidity: ${result.humidity}%\nWind Speed: ${result.wind_speed} m/s\nDescription: ${result.cloud_pct}% cloud cover`;
        setConversation([...conversation(), { role: 'system', content: weatherInfo }]);
        setWeatherCity('');
      } else {
        setConversation([...conversation(), { role: 'system', content: `Could not retrieve weather information for ${weatherCity()}.` }]);
        setWeatherCity('');
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      setConversation([...conversation(), { role: 'system', content: `Error fetching weather information for ${weatherCity()}.` }]);
      setWeatherCity('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-4">
      <Show when={currentPage() === 'login'}>
        <div class="flex items-center justify-center min-h-screen">
          <div class="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
            <h2 class="text-3xl font-bold mb-6 text-center text-purple-600">Sign in with ZAPT</h2>
            <a
              href="https://www.zapt.ai"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-500 hover:underline mb-6 block text-center"
            >
              Learn more about ZAPT
            </a>
            <Auth
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={['google', 'facebook', 'apple']}
              magicLink={true}
            />
          </div>
        </div>
      </Show>

      <Show when={currentPage() !== 'login'}>
        <div class="max-w-2xl mx-auto">
          <div class="flex justify-between items-center mb-8">
            <h1 class="text-4xl font-bold text-purple-600">Talk to a Famous Person</h1>
            <button
              class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-6 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>

          <Show when={currentPage() === 'famousPersonSelection'}>
            <div class="bg-white p-8 rounded-xl shadow-lg">
              <h2 class="text-3xl font-bold mb-6 text-center text-purple-600">Choose a Famous Person</h2>
              <input
                type="text"
                placeholder="Enter the name of the famous person"
                value={famousPerson()}
                onInput={(e) => setFamousPerson(e.target.value)}
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border text-gray-700"
              />
              <button
                onClick={handleStartConversation}
                class="mt-4 w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
              >
                Start Conversation
              </button>
            </div>
          </Show>

          <Show when={currentPage() === 'conversation'}>
            <div class="bg-white p-6 rounded-xl shadow-lg">
              <h2 class="text-2xl font-bold mb-4 text-purple-600">Conversation with {famousPerson()}</h2>
              <div class="max-h-96 overflow-y-auto mb-4">
                <For each={conversation()}>
                  {(message) => (
                    <div class={`mb-2 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <p class="font-semibold">{message.role === 'user' ? 'You' : message.role === 'assistant' ? famousPerson() : 'System'}</p>
                      <div class="inline-block bg-gray-100 p-3 rounded-lg">
                        <SolidMarkdown children={message.content} />
                      </div>
                    </div>
                  )}
                </For>
                <Show when={loading()}>
                  <div class="text-center text-gray-500">Processing...</div>
                </Show>
              </div>
              <input
                type="text"
                placeholder="Type your question here"
                value={currentQuestion()}
                onInput={(e) => setCurrentQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAskQuestion();
                  }
                }}
                class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border mb-2 text-gray-700"
                disabled={loading()}
              />
              <div class="flex flex-wrap space-x-4">
                <button
                  onClick={handleAskQuestion}
                  class={`flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${
                    loading() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={loading()}
                >
                  Ask Question
                </button>
                <button
                  onClick={() => setShowWeatherModal(true)}
                  class={`flex-1 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${
                    loading() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={loading()}
                >
                  Get Weather
                </button>
                <button
                  onClick={handleResetConversation}
                  class="flex-1 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                >
                  Talk to Someone Else
                </button>
                <button
                  onClick={handleQuit}
                  class="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                >
                  Quit
                </button>
              </div>

              <Show when={showWeatherModal()}>
                <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <div class="bg-white p-6 rounded-lg shadow-lg">
                    <h3 class="text-xl font-bold mb-4 text-purple-600">Get Weather Information</h3>
                    <input
                      type="text"
                      placeholder="Enter city name"
                      value={weatherCity()}
                      onInput={(e) => setWeatherCity(e.target.value)}
                      class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent box-border mb-4 text-gray-700"
                    />
                    <div class="flex space-x-4">
                      <button
                        onClick={handleGetWeather}
                        class={`flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer ${
                          loading() ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        disabled={loading()}
                      >
                        Get Weather
                      </button>
                      <button
                        onClick={() => setShowWeatherModal(false)}
                        class="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={currentPage() === 'homePage'}>
            <div class="bg-white p-8 rounded-xl shadow-lg text-center">
              <h2 class="text-3xl font-bold mb-6 text-center text-purple-600">Welcome Back!</h2>
              <button
                onClick={() => setCurrentPage('famousPersonSelection')}
                class="mt-4 w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
              >
                Start a New Conversation
              </button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default App;