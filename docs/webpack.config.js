module.exports = {
  entry: {
    main: './src/js/index.js',
    loadComponents: './src/js/modules/loadComponents.js',
    cards: './src/js/modules/cards.js',
    navbar: './src/js/modules/navbar.js',
    portfolio: './src/js/modules/portfolio.js',
  },
  output: {
    filename: 'js/[name].[contenthash].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|gif|ico|pdf)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[hash][ext][query]',
        },
      },
      {
        test: /\.html$/,
        use: ['html-loader'],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: './src/html/index.html',
      filename: 'index.html',
      chunks: ['main', 'navbar', 'loadComponents', 'cards'] // Include 'navbar'
    }),
    new HtmlWebpackPlugin({
      template: './src/html/templates/home.html',
      filename: 'templates/home.html',
      chunks: ['main', 'navbar', 'loadComponents', 'cards'] // Include 'navbar'
    }),
    new HtmlWebpackPlugin({
      template: './src/html/templates/resume.html',
      filename: 'templates/resume.html',
      chunks: ['main', 'navbar', 'loadComponents'] // Include 'navbar'
    }),
    new HtmlWebpackPlugin({
      template: './src/html/templates/portfolio.html',
      filename: 'templates/portfolio.html',
      chunks: ['main', 'navbar', 'loadComponents', 'portfolio'] // Include 'navbar'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/html/partials', to: 'partials' },
        { from: 'assets', to: 'assets' },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash].css',
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'src'),
    },
    compress: true,
    port: 9000,
    open: true,
  },
  mode: 'development',
};
