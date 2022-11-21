
//this is ben's code

const express = require("express");
const productData = require("./product-service");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const exphbs = require("express-handlebars");
const path = require("path");
const stripJs = require("strip-js");

const app = express();

const HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
  cloud_name: "dfigibz6e",
  api_key: "964183147451584",
  api_secret: "Ap59uY4V1aViroxLP3QA6WmeqHk",
  secure: true,
});

const upload = multer();

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    helpers: {
      navLink: function (url, options) {
        return (
          "<li" +
          (url == app.locals.activeRoute ? ' class="active" ' : "") +
          '><a href="' +
          url +
          '">' +
          options.fn(this) +
          "</a></li>"
        );
      },
      equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3)
          throw new Error("Handlebars Helper equal needs 2 parameters");
        if (lvalue != rvalue) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
      },
      safeHTML: function (context) {
        return stripJs(context);
      },
    },
  })
);

app.set("view engine", ".hbs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  let route = req.path.substring(1);
  app.locals.activeRoute =
    "/" +
    (isNaN(route.split("/")[1])
      ? route.replace(/\/(?!.*)/, "")
      : route.replace(/\/(.*)/, ""));
  app.locals.viewingCategory = req.query.category;
  next();
});

//routes
app.get("/", (req, res) => {
  res.redirect("/product");
});

// app.get("/", (req, res) => {
//   res.render("product");
// });

app.get("/home", (req, res) => {
  res.render("home");
});

app.get("/product", async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};

  try {
    // declare empty array to hold "product" objects
    let products = [];

    // if there's a "category" query, filter the returned demos by category
    if (req.query.category) {
      // Obtain the published "demos" by category
      products = await productData.getPublishedProductsByCategory(
        req.query.category
      );
    } else {
      // Obtain the published "demos"
      products = await productData.getPublishedProducts();
    }

    // sort the published demos by postDate
    products.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

    // get the latest product from the front of the list (element 0)
    let product = products[0];

    // store the "demos" and "product" data in the viewData object (to be passed to the view)
    viewData.products = products;
    viewData.product = product;
  } catch (err) {
    viewData.message = "no results";
  }

  try {
    // Obtain the full list of "categories"
    let categories = await productData.getCategories();

    // store the "categories" data in the viewData object (to be passed to the view)
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = "no results";
  }

  // render the "product" view with all of the data (viewData)
  res.render("product", { data: viewData });
});


//for demos
app.get("/demos", (req, res) => {
  if (req.query.category) {
    productData
      .getPublishedProductsByCategory(req.query.category)
      .then((data) => {
        if (data.length == 0) {
          res.render("demos", { message: "no results" });
          return;
        }
        res.render("demos", { products: data });
      })
      .catch(() => {
        res.render("demos", { message: "no results" });
      });
  } else if (req.query.minDate) {
    productData
      .getProductByMinDate(req.query.minDate)
      .then((data) => {
        if (data.length == 0) {
          res.render("demos", { message: "no results" });
          return;
        }
        res.render("demos", { products: data });
      })
      .catch(() => {
        res.render("demos", { message: "no results" });
      });
  } else {
    productData
      .getAllProducts()
      .then((data) => {
        if (data.length == 0) {
          res.render("demos", { message: "no results" });
          return;
        }
        console.log("this is demnos rendering");
        res.render("demos", { products: data });
      })
      .catch(() => res.render("demos", { message: "no results" }));
  }
});


app.get("/demos/delete/:id", (req, res) => {
  productData
    .deleteProductById(req.params.id)
    .then(() => {
      res.redirect("/demos");
    })
    .catch((err) => {
      res.status(500).send("Unable to Remove Post / Post Not Found");
    });
});

app.get("/demos/:id", (req, res) => {
  productData
    .getProductById(req.params.id)
    .then((data) => {
      res.json(data);
    })
    .catch((err) => {
      res.json({ message: err });
    });
});

//for categories
// category route
app.get("/categories", (req, res) => {
  productData
    .getCategories()
    .then((data) => {
      res.render("categories", { categories: data });
    })
    .catch((err) => {
      res.render("categories", { message: "no results" });
    });
});

app.get("/categories/add", (req, res) => {
  res.render("addCategory");
});

app.post("/categories/add", (req, res) => {
  productData
    .addCategory(req.body)
    .then((category) => {
      res.redirect("/categories");
    })
    .catch((err) => {
      res.status(500).send(err.message);
    });
});

app.get("/categories/delete/:id", (req, res) => {
  productData
    .deleteCategoryById(req.params.id)
    .then(() => {
      res.redirect("/categories");
    })
    .catch((err) => {
      res.status(500).send("Unable to Remove Category / Category Not Found");
    });
});

//for product add
app.get("/products/add", (req, res) => {
  productData
  .getCategories()
  .then((data) => {
    res.render("addProduct", { categories: data });
  })
  .catch((err) => {
    // set category list to empty array
    res.render("addProduct", { categories: [] });
  });
});

app.post("/products/add", upload.single("featureImage"), (req, res) => {
  if (req.file) {
    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        });

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };
    async function upload(req) {
      let result = await streamUpload(req);
      console.log(result);
      return result;
    }

    upload(req).then((uploaded) => {
      processProducts(uploaded.url);
    });
  } else {
    processProducts("");
  }

  function processProducts(imageUrl) {
    req.body.featureImage = imageUrl;

    productData
      .addProduct(req.body)
      .then(() => {
        console.log("rendering products pages")
        res.redirect("/product");
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }
});

app.get("/product/:id", async (req, res) => {
  // Declare an object to store properties for the view
  let viewData = {};

  try {
    // declare empty array to hold "product" objects
    let products = [];

    // if there's a "category" query, filter the returned demos by category
    if (req.query.category) {
      // Obtain the published "demos" by category
      products = await productData.getPublishedProductsByCategory(
        req.query.category
      );
    } else {
      // Obtain the published "demos"
      products = await productData.getPublishedProducts();
    }

    // sort the published demos by postDate
    products.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

    // store the "demos" and "product" data in the viewData object (to be passed to the view)
    viewData.products = products;
  } catch (err) {
    viewData.message = "no results";
  }

  try {
    // Obtain the product by "id"
    viewData.product = await productData.getProductById(req.params.id);
  } catch (err) {
    viewData.message = "no results";
  }

  try {
    // Obtain the full list of "categories"
    let categories = await productData.getCategories();

    // store the "categories" data in the viewData object (to be passed to the view)
    viewData.categories = categories;
  } catch (err) {
    viewData.categoriesMessage = "no results";
  }

  // render the "product" view with all of the data (viewData)
  res.render("product", { data: viewData });
});

app.use((req, res) => {
  res.status(404).render("404");
});

productData
  .initialize()
  .then(() => {
    app.listen(HTTP_PORT, () => {
      console.log("server listening on: " + HTTP_PORT);
    });
  })
  .catch((err) => {
    console.log(err);
  });
