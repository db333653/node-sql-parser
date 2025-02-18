const CopyPlugin = require('copy-webpack-plugin')
const FileManagerPlugin = require('filemanager-webpack-plugin')
const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const nodeExternals = require('webpack-node-externals')

const isCoverage = process.env.NODE_ENV === 'coverage'
const isProd = process.argv.includes('--prod')
const isTest = isCoverage || process.argv.includes('--test')
const subDir = isProd ? 'output/prod' : isTest ? 'output/test' : 'output/dev'
const outputPath = path.join(__dirname, subDir)
const srcPath = path.join(__dirname, 'src')
require('rimraf').sync(outputPath)

if (isProd) require('./typegen')

const moduleCfg = {
    rules: [
        {
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/,
            use: isCoverage
                ? {
                    loader: 'istanbul-instrumenter-loader',
                    options: { esModules: true },
                }
                : {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                },
            enforce: 'post',
        },
        {
            test: /\.pegjs$/,
            loader: 'pegjs-loader?dependencies={"BigInt":"big-integer"}'
        }
    ],
}

const getCopyFile = (database) => {
    return [
        { source: `${outputPath}/${database}.js`, destination: `${outputPath}/build/${database}.js` },
        { source: `${outputPath}/${database}.js.map`, destination: `${outputPath}/build/${database}.js.map` },
        { source: `${outputPath}/${database}.d.ts`, destination: `${outputPath}/build/${database}.d.ts` },
    ]
}

const getDbFile = () => ['bigquery', 'db2', 'hive', 'mariadb', 'mysql', 'postgresql', 'transactsql', 'flinksql'].map(getCopyFile).reduce((prev, curr) => [...prev, ...curr], [])

const getSrcFile = () => fs.readdirSync(srcPath).filter(name => name !== 'parser.all.js' || name !== 'parser.single.js').map(name => ({ source: `${outputPath}/${name}`, destination: `${outputPath}/lib/${name}` }))

const getPlugins = (parserName, target, plugins) => [
    new webpack.DefinePlugin({
        PARSER_NAME: parserName ? JSON.stringify(parserName) : 'null',
    }),
    ...(plugins || []),
    ...(isProd
        ? [
            new CopyPlugin({
                patterns: [
                    'LICENSE',
                    'lib',
                    'README.md',
                    'package.json',
                    'types.d.ts',
                    'ast/**',
                    {
                        from: 'index.d.ts',
                        to: (parserName || 'index') + (target === 'web' ? '.umd' : '') + '.d.ts',
                    }
                ],
            }),
            new FileManagerPlugin({
                onEnd: {
                    mkdir: [
                        `${outputPath}/umd`,
                        `${outputPath}/build`,
                        `${outputPath}/lib`,
                    ],
                    copy: [
                        { source: `${outputPath}/*.umd.d.ts`, destination: `${outputPath}/umd` },
                        { source: `${outputPath}/*.umd.js`, destination: `${outputPath}/umd` },
                        { source: `${outputPath}/*.umd.js.map`, destination: `${outputPath}/umd` },
                    ],
                    move: [
                        ...getDbFile(),
                        ...getSrcFile(),
                    ],
                    delete: [
                        `${outputPath}/*.umd.d.ts`,
                        `${outputPath}/*.umd.js`,
                        `${outputPath}/*.umd.js.map`,
                        `${outputPath}/index.d.ts`
                    ]
                }
            })
        ] : [
        ])
    ]
const getOutput = (target) => ({
    path: outputPath,
    library: '',
    libraryTarget: target === 'web' ? 'umd' : 'commonjs',
    // this ensures that source maps are mapped to actual files (not "webpack:" uris)
    devtoolModuleFilenameTemplate: info => path.resolve(__dirname, info.resourcePath),
})
function buildConfig(parserName, target, entry, plugins) {
    const watch = !(isProd || isTest || isCoverage)
    return {
        devtool: 'source-map',
        externals: target == 'web' ? [] : [
            nodeExternals({
                whitelist: ['webpack/hot/poll?100'],
            }),
        ],
        entry,
        watch,
        target,
        mode: isProd ? 'production' : 'development',
        node: { __dirname: false },
        module: moduleCfg,
        resolve: { extensions: ['.js', '.pegjs'] },
        plugins: getPlugins(parserName, target, plugins),
        output: getOutput(target),
    }
}

// =========== PROD CONFIG ================
if (isProd) {
    const config = module.exports = []

    for (const target of ['web', 'node']) {
        config.push(
            // full bundle
            buildConfig(null, target, {
                ['index' + (target === 'web' ? '.umd' : '')]: ['./index.js'],
            }),
            // Add one light bundle per language
            ...fs.readdirSync(path.join(__dirname, 'pegjs'))
                .map(x => /^(.+)\.pegjs$/.exec(x))
                .filter(x => !!x)
                .map(x => x[1])
                .map(parser =>
                    buildConfig(parser, target, {
                        [parser + (target === 'web' ? '.umd' : '')]: ['./index.js'],
                    }, [
                        new webpack.NormalModuleReplacementPlugin(
                            /parser\.all/,
                            './parser.single'
                        ),
                        new webpack.NormalModuleReplacementPlugin(
                            /mysql\.pegjs/,
                            '../pegjs/' + parser + '.pegjs'
                        ),
                    ])
                ))
    }
} else {
    // ============= DEV CONFIG (watch) ==============
    module.exports = isTest
        ? buildConfig(null, 'node', {
            'tests': ['./tests-index.js'],
        })
        // test bundle (HMR)
        : buildConfig(null, 'node', {
                'tests': ['webpack/hot/poll?100', './tests-index.js'],
            }, [new webpack.HotModuleReplacementPlugin()])
}
npm init -y
npm install --save-dev webpack webpack-cli webpack-dev-server
npm install --save-dev babel-loader @babel/core @babel/preset-env css-loader style-loader
const path = require('path');

module.exports = {
  entry: './src/index.js', // Your entry file
  output: {
    filename: 'bundle.js',  // The output file after Webpack compiles
    path: path.resolve(__dirname, 'dist'), // Output directory
  },
  module: {
    rules: [
      {
        test: /\.js$/, // Transpile JS files using Babel
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/, // Use CSS loaders
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 9000,
  },
  mode: 'development',  // Or 'production' for production builds
};
/src
  index.js
  style.css
import './style.css';

console.log('Hello from Webpack!');
body {
  background-color: lightblue;
}
body {
  background-color: lightblue;
}
"scripts": {
  "start": "webpack serve --open",
  "build": "webpack --mode production"
}
git init
git add .
git commit -m "Initial commit with Webpack setup"
git branch -M main
git remote add origin https://github.com/yourusername/yourrepository.git
git push -u origin main
node_modules/
dist/
npm install --save-dev gh-pages
"scripts": {
  "start": "webpack serve --open",
  "build": "webpack --mode production",
  "deploy": "gh-pages -d dist"
}
npm run deploy
npm run deploy
npm run deploy
module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',  // Handles image files as assets
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',  // Handles font files as assets
      },
    ],
  },
  mode: 'development',
};
module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.scss$/,
        use: [
          'style-loader',   // Inject styles into DOM
          'css-loader',     // Turns CSS into JS
          'sass-loader',    // Compiles Sass to CSS
        ],
      },
    ],
  },
  mode: 'development',
};
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader, // Extract CSS to a separate file
          'css-loader',
        ],
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,  // Extract CSS
          'css-loader',
          'sass-loader',
        ],
      },
    ],
  },
  optimization: {
    minimize: true,  // Enable code minification
    minimizer: [
      new TerserWebpackPlugin(),  // Minify JavaScript
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
  mode: 'production',
};
const webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ],
  mode: 'development', // or 'production'
};
module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devServer: {
    contentBase: './dist',
    hot: true,  // Enable HMR
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),  // Enable HMR plugin
  ],
  mode: 'development',
};
module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devtool: 'source-map',  // Generates a source map
  mode: 'development',
};
