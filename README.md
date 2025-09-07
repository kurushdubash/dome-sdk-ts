## Installation

```bash
# Using npm
npm install @dome/sdk

# Using yarn
yarn add @dome/sdk

# Using pnpm
pnpm add @dome/sdk
```

## Configuration

The SDK accepts the following configuration options:

```typescript
interface DomeSDKConfig {
  /** Authentication token for API requests */
  apiKey?: string;
```

### Environment Variables

You can also configure the SDK using environment variables:

```bash
DOME_API_KEY=your-api-token
```

```typescript
const dome = new DomeClient({
  apiKey: process.env.DOME_API_KEY,
});
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- **Kurush Dubash** - [kurush@dome.com](mailto:kurush@dome.com)
- **Kunal Roy** - [kunal@dome.com](mailto:kunal@dome.com)
