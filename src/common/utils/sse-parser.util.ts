import { Readable } from 'stream';

export async function* parseSSE(stream: Readable): AsyncGenerator<any> {
  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep the incomplete line

    for (const line of lines) {
      if (line.trim() === '' || !line.startsWith('data: ')) {
        continue;
      }

      const dataStr = line.slice(6); // Remove 'data: ' prefix
      try {
        const data = JSON.parse(dataStr);
        yield data;
      } catch (e) {
        // Ignore JSON parse errors for incomplete data
      }
    }
  }

  // Process remaining buffer if it's a complete line (unlikely but safe)
  if (buffer.startsWith('data: ')) {
    try {
      yield JSON.parse(buffer.slice(6));
    } catch (e) {}
  }
}
