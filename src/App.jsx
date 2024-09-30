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

  return (
    <div class="min-h-screen bg-gradient-to-br from-green-100 to-blue-100 p-6 text-gray-800">
      <Show when={currentPage() === 'login'}>
        <div class="flex items-center justify-center min-h-screen">
          <div class="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
            <h2 class="text-4xl font-bold mb-8 text-center text-green-600">Sign in with ZAPT</h2>
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
        <div class="max-w-3xl mx-auto h-full">
          <div class="flex justify-between items-center mb-10">
            <h1 class="text-5xl font-bold text-green-600">Talk to a Famous Person</h1>
            <button
              class="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>

          <Show when={currentPage() === 'famousPersonSelection'}>
            <div class="bg-white p-10 rounded-xl shadow-lg">
              <h2 class="text-4xl font-bold mb-8 text-center text-green-600">Choose a Famous Person</h2>
              <input
                type="text"
                placeholder="Enter the name of the famous person"
                value={famousPerson()}
                onInput={(e) => setFamousPerson(e.target.value)}
                class="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent box-border text-gray-800 text-lg mb-6"
              />
              <button
                onClick={handleStartConversation}
                class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer text-lg"
              >
                Start Conversation
              </button>
            </div>
          </Show>

          <Show when={currentPage() === 'conversation'}>
            <div class="bg-white p-8 rounded-xl shadow-lg h-full flex flex-col">
              <h2 class="text-3xl font-bold mb-6 text-green-600">Conversation with {famousPerson()}</h2>
              <div class="flex-1 overflow-y-auto mb-6 p-2 border border-gray-200 rounded-lg">
                <For each={conversation()}>
                  {(message) => (
                    <div class={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <p class="font-semibold text-lg">{message.role === 'user' ? 'You' : famousPerson()}</p>
                      <div class="inline-block bg-gray-100 p-4 rounded-lg">
                        <SolidMarkdown children={message.content} />
                      </div>
                    </div>
                  )}
                </For>
                <Show when={loading()}>
                  <div class="text-center text-gray-500">Processing...</div>
                </Show>
              </div>
              <div class="flex items-center space-x-4">
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
                  class="flex-1 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent box-border text-gray-800 text-lg"
                  disabled={loading()}
                />
                <button
                  onClick={handleAskQuestion}
                  class={`px-6 py-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer text-lg ${
                    loading() ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={loading()}
                >
                  Ask Question
                </button>
              </div>

              <div class="flex mt-6 space-x-4">
                <button
                  onClick={handleResetConversation}
                  class="flex-1 px-6 py-4 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer text-lg"
                >
                  Talk to Someone Else
                </button>
                <button
                  onClick={handleQuit}
                  class="flex-1 px-6 py-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer text-lg"
                >
                  Quit
                </button>
              </div>
            </div>
          </Show>

          <Show when={currentPage() === 'homePage'}>
            <div class="bg-white p-10 rounded-xl shadow-lg text-center">
              <h2 class="text-4xl font-bold mb-8 text-center text-green-600">Welcome Back!</h2>
              <button
                onClick={() => setCurrentPage('famousPersonSelection')}
                class="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-green-400 transition duration-300 ease-in-out transform hover:scale-105 cursor-pointer text-lg"
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