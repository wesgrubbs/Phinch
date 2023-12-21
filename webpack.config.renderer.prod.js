/* eslint-disable import/first */
/**
 * Build config for electron renderer process
 */

require("@babel/register");

const path = require("path");
const webpack = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const merge = require("webpack-merge");
const TerserPlugin = require("terser-webpack-plugin");
const baseConfig = require("./webpack.config.base");
const CheckNodeEnv = require("./internals/scripts/CheckNodeEnv");

CheckNodeEnv("production");

module.exports = merge.smart(baseConfig, {
  mode: "production",

  devtool: "source-map",

  target: "electron-renderer",

  entry: "./app/index",

  optimizer: {
    minimizer: [
      new TerserPlugin({
        parallel: true,
        sourceMap: true
      })
    ]
  },

  output: {
    path: path.join(__dirname, "app/dist"),
    publicPath: "./dist/",
    filename: "renderer.prod.js"
  },

  module: {
    rules: [
      // Extract all .global.css to style.css as is
      {
        test: /\.global\.css$/,
        use: MiniCssExtractPlugin.extract({
          publicPath: "./",
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: {
                minimize: true
              }
            }
          ],
          fallback: "style-loader"
        })
      },
      // Pipe other styles through css modules and append to style.css
      {
        test: /^((?!\.global).)*\.css$/,
        use: ExtractTextPlugin.extract({
          use: {
            loader: "css-loader",
            options: {
              modules: true,
              minimize: true,
              importLoaders: 1,
              localIdentName: "[name]__[local]__[hash:base64:5]"
            }
          }
        })
      },
      // Add SASS support  - compile all .global.scss files and pipe it to style.css
      {
        test: /\.global\.(scss|sass)$/,
        use: ExtractTextPlugin.extract({
          use: [
            {
              loader: "css-loader",
              options: {
                minimize: true
              }
            },
            {
              loader: "sass-loader"
            }
          ],
          fallback: "style-loader"
        })
      },
      // Add SASS support  - compile all other .scss files and pipe it to style.css
      {
        test: /^((?!\.global).)*\.(scss|sass)$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[name]__[local]__[hash:base64:5]"
              },
              importLoaders: 1,
              minimize: true
            }
          },
          "sass-loader"
        ]
      },
      // WOFF Font
      {
        test: /\.woff(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "application/font-woff"
          }
        }
      },
      // WOFF2 Font
      {
        test: /\.woff2(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "application/font-woff"
          }
        }
      },
      // TTF Font
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "application/octet-stream"
          }
        }
      },
      // EOT Font
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        use: "file-loader"
      },
      // SVG Font
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        use: {
          loader: "url-loader",
          options: {
            limit: 10000,
            mimetype: "image/svg+xml"
          }
        }
      },
      // Common Image Formats
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        use: "url-loader"
      }
    ]
  },

  plugins: [
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
      NODE_ENV: "production"
    }),

    new MiniCssExtractPlugin({
      filename: "style.css"
    }),

    new BundleAnalyzerPlugin({
      analyzerMode:
        process.env.OPEN_ANALYZER === "true" ? "server" : "disabled",
      openAnalyzer: process.env.OPEN_ANALYZER === "true"
    })
  ]
});
