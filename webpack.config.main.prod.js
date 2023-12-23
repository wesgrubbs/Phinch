/* eslint-disable import/first */
/**
 * Webpack config for production electron main process
 */

require('@babel/register');

const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CheckNodeEnv = require('./internals/scripts/CheckNodeEnv');

CheckNodeEnv('production');

module.exports = {
  mode: 'production',

  target: 'electron-main',

  entry: './app/main.dev',

  output: {
    path: __dirname,
    filename: './app/main.prod.js',
  },

  optimization: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        sourceMap: true,
      }),
    ],
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/, // .js, .jsx
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            presets: [
              // "@babel/preset-env",
              [
                '@babel/preset-env',
                {
                  targets: { node: 7 },
                  useBuiltIns: 'usage',
                  corejs: 3,
                },
              ],
              '@babel/preset-react',
              '@babel/preset-flow',
            ],
            plugins: [
              // Here, we include babel plugins that are only required for the
              // renderer process. The 'transform-*' plugins must be included
              // before react-hot-loader/babel
              // "@babel/plugin-transform-classes",
              '@babel/plugin-proposal-class-properties',
              './node_modules/react-hot-loader/babel',
            ],
          },
        },
      },
    ],
  },

  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true',
    }),

    /**
     * Create global constants which can be configured at compile time.
     *
     * Useful for allowing different behaviour between development builds and
     * release builds
     *
     * NODE_ENV should be production so that modules do not perform certain
     * development checks
     */
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: 'false',
    }),
  ],

  /**
   * Disables webpack processing of __dirname and __filename.
   * If you run the bundle in node.js it falls back to these values of node.js.
   * https://github.com/webpack/webpack/issues/2010
   */
  node: {
    __dirname: false,
    __filename: false,
  },
};
