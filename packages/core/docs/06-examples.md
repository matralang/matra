# Examples

Real-world examples demonstrating @matra/core usage.

## Table of Contents

- [Blog Post Card](#blog-post-card)
- [Navigation Menu](#navigation-menu)
- [User Profile](#user-profile)
- [Product Grid](#product-grid)
- [Form with Validation](#form-with-validation)
- [Data Table](#data-table)
- [Comment Thread](#comment-thread)
- [Dashboard Widget](#dashboard-widget)

## Blog Post Card

A reusable blog post card component:

```javascript
import { compile } from '@matra/core';

const template = `
  article[class="post-card"] {
    m-if[test="\${post.featured}"] {
      span[class="badge"] { "Featured" }
    }
    img[src="\${post.image}" alt="\${post.title}"]
    div[class="post-content"] {
      h2 { "\${post.title}" }
      p[class="meta"] {
        "By "
        strong { "\${post.author}" }
        " on "
        time[datetime="\${post.date}"] { "\${formatDate(post.date)}" }
      }
      p[class="excerpt"] { "\${post.excerpt}" }
      div[class="tags"] {
        span[m-each="\${post.tags}" m-each:item="tag" class="tag"] {
          "\${tag}"
        }
      }
      a[href="\${post.url}" class="read-more"] { "Read More →" }
    }
  }
`;

const render = compile(template);

const post = {
  featured: true,
  image: '/images/post1.jpg',
  title: 'Getting Started with Matra',
  author: 'Alice',
  date: '2025-01-15',
  excerpt: 'Learn how to use Matra templates in your projects.',
  tags: ['tutorial', 'javascript', 'templates'],
  url: '/posts/getting-started'
};

const html = render({
  post,
  formatDate: (date) => new Date(date).toLocaleDateString()
});

console.log(html);
```

**Output:**

```html
<article class="post-card">
  <span class="badge">Featured</span>
  <img src="/images/post1.jpg" alt="Getting Started with Matra">
  <div class="post-content">
    <h2>Getting Started with Matra</h2>
    <p class="meta">By <strong>Alice</strong> on <time datetime="2025-01-15">1/15/2025</time></p>
    <p class="excerpt">Learn how to use Matra templates in your projects.</p>
    <div class="tags">
      <span class="tag">tutorial</span>
      <span class="tag">javascript</span>
      <span class="tag">templates</span>
    </div>
    <a href="/posts/getting-started" class="read-more">Read More →</a>
  </div>
</article>
```

## Navigation Menu

Dynamic navigation with active state:

```javascript
const navTemplate = `
  nav[class="main-nav"] {
    ul {
      li[m-each="\${navItems}" m-each:item="item" class="\${item.url === currentPath ? 'active' : ''}"] {
        a[href="\${item.url}"] { "\${item.label}" }
      }
    }
  }
`;

const render = compile(navTemplate);

const context = {
  navItems: [
    { label: 'Home', url: '/' },
    { label: 'About', url: '/about' },
    { label: 'Blog', url: '/blog' },
    { label: 'Contact', url: '/contact' }
  ],
  currentPath: '/blog'
};

console.log(render(context));
```

**Output:**

```html
<nav class="main-nav">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
    <li class="active"><a href="/blog">Blog</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

## User Profile

User profile with conditional badges:

```javascript
const profileTemplate = `
  div[class="user-profile"] {
    img[src="\${user.avatar}" alt="\${user.name}" class="avatar"]
    div[class="user-info"] {
      h3 { "\${user.name}" }
      m-if[test="\${user.verified}"] {
        span[class="badge verified"] { "✓ Verified" }
      }
      m-if[test="\${user.premium}"] {
        span[class="badge premium"] { "★ Premium" }
      }
      p[class="bio"] { "\${user.bio}" }
      div[class="stats"] {
        span { "Posts: \${user.postCount}" }
        span { "Followers: \${user.followers}" }
        span { "Following: \${user.following}" }
      }
    }
  }
`;

const render = compile(profileTemplate);

const user = {
  avatar: '/avatars/alice.jpg',
  name: 'Alice Johnson',
  verified: true,
  premium: true,
  bio: 'Full-stack developer and tech enthusiast.',
  postCount: 42,
  followers: 1230,
  following: 456
};

console.log(render({ user }));
```

## Product Grid

E-commerce product grid with sale badges:

```javascript
const gridTemplate = `
  div[class="product-grid"] {
    div[m-each="\${products}" m-each:item="product" class="product-card"] {
      m-if[test="\${product.onSale}"] {
        span[class="sale-badge"] { "-\${product.discount}%" }
      }
      img[src="\${product.image}" alt="\${product.name}"]
      h3 { "\${product.name}" }
      div[class="price"] {
        m-if[test="\${product.onSale}"] {
          span[class="original-price"] { "$\${product.originalPrice}" }
          span[class="sale-price"] { "$\${product.price}" }
        }
        m-else {
          span { "$\${product.price}" }
        }
      }
      div[class="rating"] {
        span { "★".repeat(\${product.rating}) }
        span[class="reviews"] { "(\${product.reviews})" }
      }
      button[class="add-to-cart"] { "Add to Cart" }
    }
  }
`;

const render = compile(gridTemplate);

const products = [
  {
    name: 'Wireless Headphones',
    image: '/products/headphones.jpg',
    price: 79.99,
    originalPrice: 99.99,
    onSale: true,
    discount: 20,
    rating: 4,
    reviews: 328
  },
  {
    name: 'Smart Watch',
    image: '/products/watch.jpg',
    price: 199.99,
    onSale: false,
    rating: 5,
    reviews: 512
  }
];

console.log(render({ products }));
```

## Form with Validation

Form with error messages:

```javascript
const formTemplate = `
  form[action="/submit" method="post" class="contact-form"] {
    div[class="form-group"] {
      label[for="name"] { "Name" }
      input[type="text" id="name" name="name" value="\${formData.name}" class="\${errors.name ? 'error' : ''}"]
      m-if[test="\${errors.name}"] {
        span[class="error-message"] { "\${errors.name}" }
      }
    }
    div[class="form-group"] {
      label[for="email"] { "Email" }
      input[type="email" id="email" name="email" value="\${formData.email}" class="\${errors.email ? 'error' : ''}"]
      m-if[test="\${errors.email}"] {
        span[class="error-message"] { "\${errors.email}" }
      }
    }
    div[class="form-group"] {
      label[for="message"] { "Message" }
      textarea[id="message" name="message" class="\${errors.message ? 'error' : ''}"] {
        "\${formData.message}"
      }
      m-if[test="\${errors.message}"] {
        span[class="error-message"] { "\${errors.message}" }
      }
    }
    button[type="submit" class="btn-primary"] { "Send Message" }
  }
`;

const render = compile(formTemplate);

const context = {
  formData: {
    name: '',
    email: 'invalid-email',
    message: ''
  },
  errors: {
    name: 'Name is required',
    email: 'Please enter a valid email address',
    message: 'Message must be at least 10 characters'
  }
};

console.log(render(context));
```

## Data Table

Sortable data table:

```javascript
const tableTemplate = `
  table[class="data-table"] {
    thead {
      tr {
        th[m-each="\${columns}" m-each:item="col" class="\${sortBy === col.key ? 'sorted' : ''}"] {
          a[href="#" data-sort="\${col.key}"] {
            "\${col.label}"
            m-if[test="\${sortBy === col.key}"] {
              span { "\${sortDir === 'asc' ? '↑' : '↓'}" }
            }
          }
        }
      }
    }
    tbody {
      tr[m-each="\${rows}" m-each:item="row"] {
        td[m-each="\${columns}" m-each:item="col"] {
          "\${row[col.key]}"
        }
      }
    }
  }
`;

const render = compile(tableTemplate);

const context = {
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' }
  ],
  rows: [
    { name: 'Alice', email: 'alice@example.com', role: 'Admin', status: 'Active' },
    { name: 'Bob', email: 'bob@example.com', role: 'User', status: 'Active' },
    { name: 'Carol', email: 'carol@example.com', role: 'User', status: 'Inactive' }
  ],
  sortBy: 'name',
  sortDir: 'asc'
};

console.log(render(context));
```

## Comment Thread

Nested comment thread:

```javascript
const commentTemplate = `
  div[class="comment-thread"] {
    div[m-each="\${comments}" m-each:item="comment" class="comment"] {
      img[src="\${comment.avatar}" alt="\${comment.author}" class="avatar"]
      div[class="comment-content"] {
        div[class="comment-header"] {
          strong { "\${comment.author}" }
          time[datetime="\${comment.date}"] { "\${formatDate(comment.date)}" }
        }
        p { "\${comment.text}" }
        m-if[test="\${comment.replies && comment.replies.length > 0}"] {
          div[class="replies"] {
            div[m-each="\${comment.replies}" m-each:item="reply" class="comment reply"] {
              img[src="\${reply.avatar}" alt="\${reply.author}" class="avatar"]
              div[class="comment-content"] {
                div[class="comment-header"] {
                  strong { "\${reply.author}" }
                  time[datetime="\${reply.date}"] { "\${formatDate(reply.date)}" }
                }
                p { "\${reply.text}" }
              }
            }
          }
        }
      }
    }
  }
`;

const render = compile(commentTemplate);

const comments = [
  {
    author: 'Alice',
    avatar: '/avatars/alice.jpg',
    date: '2025-01-15T10:30:00Z',
    text: 'Great article! Very helpful.',
    replies: [
      {
        author: 'Bob',
        avatar: '/avatars/bob.jpg',
        date: '2025-01-15T11:00:00Z',
        text: 'I agree! Thanks for sharing.'
      }
    ]
  },
  {
    author: 'Carol',
    avatar: '/avatars/carol.jpg',
    date: '2025-01-15T12:00:00Z',
    text: 'Looking forward to more content like this.',
    replies: []
  }
];

console.log(render({
  comments,
  formatDate: (date) => new Date(date).toLocaleString()
}));
```

## Dashboard Widget

Dashboard statistics widget:

```javascript
const widgetTemplate = `
  div[class="dashboard-widget"] {
    h3 { "\${widget.title}" }
    div[class="stats-grid"] {
      div[m-each="\${widget.stats}" m-each:item="stat" class="stat-card"] {
        div[class="stat-icon"] { "\${stat.icon}" }
        div[class="stat-value"] { "\${stat.value}" }
        div[class="stat-label"] { "\${stat.label}" }
        m-if[test="\${stat.change}"] {
          div[class="stat-change \${stat.change > 0 ? 'positive' : 'negative'}"] {
            "\${stat.change > 0 ? '↑' : '↓'} \${Math.abs(stat.change)}%"
          }
        }
      }
    }
    m-if[test="\${widget.showChart}"] {
      div[class="chart"] {
        canvas[id="\${widget.chartId}" width="400" height="200"]
      }
    }
  }
`;

const render = compile(widgetTemplate);

const widget = {
  title: 'Monthly Overview',
  stats: [
    { icon: '👥', label: 'Total Users', value: '1,234', change: 12.5 },
    { icon: '📊', label: 'Revenue', value: '$45,678', change: -3.2 },
    { icon: '📈', label: 'Conversions', value: '89', change: 8.7 },
    { icon: '⭐', label: 'Avg Rating', value: '4.8', change: null }
  ],
  showChart: true,
  chartId: 'monthly-chart'
};

console.log(render({ widget }));
```

## Next Steps

- **[API Reference](./04-api-reference.md)**: Explore the full API
- **[Integration Guide](./05-integration.md)**: Integrate Matra into your project
- **[Directives](./03-directives.md)**: Learn about control flow directives

---

For more information, see the [main README](../README.md).
