using Microsoft.JSInterop;
using System.Text.Json;
using System.Threading.Tasks;

namespace FawlAI.Services
{
    public class BlazorLocalStorage
    {
        private readonly IJSRuntime _js;

        public BlazorLocalStorage(IJSRuntime js)
        {
            _js = js;
        }

        public async Task<T?> GetItemAsync<T>(string key)
        {
            var json = await _js.InvokeAsync<string?>("localStorage.getItem", key);
            if (string.IsNullOrEmpty(json)) return default;
            
            if (typeof(T) == typeof(string))
            {
                try
                {
                    var deserialized = JsonSerializer.Deserialize<string>(json);
                    return (T?)(object?)deserialized;
                }
                catch
                {
                    return (T?)(object)json;
                }
            }
            return JsonSerializer.Deserialize<T>(json);
        }

        public async Task SetItemAsync<T>(string key, T value)
        {
            if (value is string str)
            {
                var json = JsonSerializer.Serialize(str);
                await _js.InvokeVoidAsync("localStorage.setItem", key, json);
            }
            else
            {
                var json = JsonSerializer.Serialize(value);
                await _js.InvokeVoidAsync("localStorage.setItem", key, json);
            }
        }

        public async Task RemoveItemAsync(string key)
        {
            await _js.InvokeVoidAsync("localStorage.removeItem", key);
        }
    }
}
