/* eslint global-require: 0, import/no-dynamic-require: 0 */

/**
 * Build config for development electron renderer process that uses
 * Hot-Module-Replacement
 *
 * https://webpack.js.org/concepts/hot-module-replacement/
 */

import path from 'path';
import fs from 'fs';
import webpack from 'webpack';
import chalk from 'chalk';
import { spawn, execSync } from 'child_process';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import baseConfig from './webpack.config.base';
import CheckNodeEnv from './internals/scripts/CheckNodeEnv';

CheckNodeEnv('development');

const port = process.env.PORT || 1212;
const publicPath = `http://localhost:${port}/dist`;
const dll = path.resolve(process.cwd(), 'dll');
const manifest = path.resolve(dll, 'renderer.json');

/**
 * Warn if the DLL is not built
 */
if (!(fs.existsSync(dll) && fs.existsSync(manifest))) {
  console.log(chalk.black.bgYellow.bold('The DLL files are missing. Sit back while we build them for you with "npm run build-dll"'));
  execSync('npm run build-dll');
}

export default {
  ...baseConfig,
  devtool: 'inline-source-map',

  target: 'web',

  entry: {
    main: [
      'react-hot-loader/patch',
      `webpack-dev-server/client?http://localhost:${port}/`,
      'webpack/hot/only-dev-server',
      path.join(__dirname, 'app/index.js'),
    ],
  },

  output: {
    publicPath: `http://localhost:${port}/dist/`,
    filename: 'renderer.dev.js',
  },

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',

          options: {
            cacheDirectory: true,
            presets: ['@babel/preset-env', '@babel/preset-react'],
            plugins: [
              'transform-class-properties',
              'transform-es2015-classes',
              'react-hot-loader/babel',
            ],
          },
        },
      },
      {
        test: /\.global\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
              localIdentName: '[name]__[local]__[hash:base64:5]',
            },
          },
        ],
      },
      {
        test: /\.global\.(scss|sass)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
            },
          },
          {
            loader: 'sass-loader',
          },
        ],
      },
      {
        test: /^((?!\.global).)*\.(scss|sass)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: true,
              sourceMap: true,
              importLoaders: 1,
              localIdentName: '[name]__[local]__[hash:base64:5]',
            },
          },
          {
            loader: 'sass-loader',
          },
        ],
      },
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff',
          },
        },
      },
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff',
          },
        },
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/octet-stream',
          },
        },
      },
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        use: 'file-loader',
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'image/svg+xml',
          },
        },
      },
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        use: 'url-loader',
      },
    ],
  },

  plugins: [
    ...baseConfig.plugins,

    new webpack.DllReferencePlugin({
      context: process.cwd(),
      manifest: require(manifest),
      sourceType: 'var',
    }),

    new webpack.HotModuleReplacementPlugin({
      multiStep: true,
    }),

    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
    }),

    new webpack.LoaderOptionsPlugin({
      debug: true,
    }),

    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],

  node: {
    __dirname: false,
    __filename: false,
  },

  devServer: {
    port,
    // publicPath,
    compress: true,
    client: {
      logging: 'error'
    },
    hot: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
    static: {
      directory: path.join(__dirname, 'dist'),
      watch: {
        ignored: /node_modules/,
        aggregateTimeout: 300,
        poll: 100,
      },
    },
    historyApiFallback: {
      verbose: true,
      disableDotRule: false,
    },
    onBeforeSetupMiddleware: function (devServer) {
      if (process.env.START_HOT) {
        console.log('Starting Main Process...');
        spawn(
          'npm',
          ['run', 'start-main-dev'],
          { shell: true, env: process.env, stdio: 'inherit' }
        )
        .on('close', (code) => process.exit(code))
        .on('error', (spawnError) => console.error(spawnError));
      }
    },
  },
};
