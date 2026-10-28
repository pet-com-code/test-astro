import {
    sqliteTable,
    text,
    integer,
    real,
    primaryKey,
    foreignKey,
    index
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// =========================================================================
// 1. 공통 상수 및 타입 정의
// =========================================================================

export const userRoles = ["user", "blogger", "partner", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const genderValues = ["M", "F", "U"] as const; // 수컷, 암컷, 알수없음

export const findTypeValues = ["MISSING", "SIGHTED", "PROTECTED"] as const;
export const findStatusValues = ["SEARCHING", "RESOLVED"] as const;

export const productStatusValues = [
    "ON_SALE",
    "OUT_OF_STOCK",
    "HIDDEN"
] as const;
export const shortsStatusValues = ["PENDING", "APPROVED", "REJECTED"] as const;
export const shortsCategoryValues = [
    "REVIEW",
    "TIP",
    "FIND_PICKUP",
    "DAILY"
] as const;

export const petTypeValues = ["DG", "CT"] as const;
export const categoryCodeValues = ["FO", "SN", "TY", "CL", "SU"] as const;

export const growthStageValues = ["PP", "AD", "SR"] as const;
export const formulationValues = ["DR", "WT", "BK", "FD", "JE", "CH"] as const;
export const careValues = ["JT", "SK", "WG", "DG", "GE"] as const;
export const ingredientsValues = ["CH", "SA", "BE", "DU", "LA", "VE"] as const;

export const playTypeValues = ["PL", "CH", "FT", "IQ", "BL"] as const;
export const materialValues = ["FA", "RU", "WO", "PL"] as const;

export const clothingTypeValues = ["TS", "OT", "OP", "RA", "AC"] as const;
export const sizeValues = ["XS", "SM", "MD", "LG", "XL", "2X", "FR"] as const;

export const supplySubCategoryValues = ["HY", "LT", "GR", "WT", "WA"] as const;
export const volumeUnitValues = ["K", "G", "P"] as const;

// =========================================================================
// 2. 메인 DB 테이블 정의
// =========================================================================

// 2.1 회원 테이블
export const profiles = sqliteTable("profiles", {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull().unique(),
    username: text("username").notNull(),
    avatarUrl: text("avatar_url"),
    phoneNumber: text("phone_number"),
    roles: text("roles", { enum: userRoles }).default("user").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .$defaultFn(() => new Date())
        .notNull()
});

// 2.2 품종 마스터 테이블 (id 접두어 cat_, dog_로 식별되므로 petType 제거)
export const breeds = sqliteTable(
    "breeds",
    {
        id: text("id").primaryKey(), // e.g. "dog_retriever", "cat_persian"
        name: text("name").notNull()
    },
    (table) => [index("breeds_name_idx").on(table.name)]
);

// 2.3 실종/제보/보호 게시글 테이블
export const finds = sqliteTable(
    "finds",
    {
        id: integer("find_id").primaryKey({ autoIncrement: true }),
        userId: text("user_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),
        breedId: text("breed_id").references(() => breeds.id, {
            onDelete: "set null"
        }),
        findType: text("find_type")
            .$type<(typeof findTypeValues)[number]>()
            .notNull(),
        status: text("status")
            .$type<(typeof findStatusValues)[number]>()
            .default("SEARCHING")
            .notNull(),
        title: text("title").notNull(),
        description: text("description").notNull(),

        eventTime: integer("event_time", { mode: "timestamp" }),
        gender: text("gender")
            .$type<(typeof genderValues)[number]>()
            .default("U"),
        isNeutered: integer("is_neutered", { mode: "boolean" }).default(false),
        age: text("age"),
        microchipId: text("microchip_id"),

        latitude: real("latitude").notNull(),
        longitude: real("longitude").notNull(),
        address: text("address"),
        locationDetail: text("location_detail"),
        geohash: text("geohash"),

        imageUrls: text("image_urls", { mode: "json" })
            .$type<string[]>()
            .notNull()
            .$defaultFn(() => []),
        videoUrl: text("video_url"),
        views: integer("views").default(0).notNull(),

        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        index("finds_user_idx").on(table.userId),
        index("finds_breed_status_idx").on(table.breedId, table.status)
    ]
);

// 2.4 제보 댓글 테이블
export const findComments = sqliteTable(
    "find_comments",
    {
        id: integer("comment_id").primaryKey({ autoIncrement: true }),
        findId: integer("find_id")
            .notNull()
            .references(() => finds.id, { onDelete: "cascade" }),
        authorId: text("author_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),

        content: text("content").notNull(),
        latitude: real("latitude"),
        longitude: real("longitude"),
        witnessTime: integer("witness_time", { mode: "timestamp" }),
        imageUrls: text("image_urls", { mode: "json" })
            .$type<string[]>()
            .$defaultFn(() => []),
        isPrivate: integer("is_private", { mode: "boolean" })
            .default(false)
            .notNull(),
        isDeleted: integer("is_deleted", { mode: "boolean" })
            .default(false)
            .notNull(),

        parentId: integer("parent_id"),
        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        index("find_comments_find_idx").on(table.findId),
        index("find_comments_author_idx").on(table.authorId),
        index("find_comments_parent_idx").on(table.parentId),
        foreignKey({
            columns: [table.parentId],
            foreignColumns: [table.id],
            name: "find_comments_parent_id_fk"
        }).onDelete("cascade")
    ]
);

// 2.5 상품 메인 테이블
export const products = sqliteTable(
    "products",
    {
        id: integer("product_id").primaryKey({ autoIncrement: true }),
        sellerId: text("seller_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),

        categoryCode: text("category_code")
            .$type<(typeof categoryCodeValues)[number]>()
            .notNull(),
        petType: text("pet_type")
            .$type<(typeof petTypeValues)[number]>()
            .notNull(),

        brand: text("brand"),
        productName: text("product_name", { length: 150 }).notNull(),
        price: integer("price").notNull(),
        discountPrice: integer("discount_price"),
        stockQuantity: integer("stock_quantity").default(0).notNull(),

        status: text("status")
            .$type<(typeof productStatusValues)[number]>()
            .default("ON_SALE")
            .notNull(),

        imageUrls: text("image_urls", { mode: "json" })
            .$type<string[]>()
            .notNull()
            .$defaultFn(() => []),
        videoUrls: text("video_urls", { mode: "json" })
            .$type<string[]>()
            .notNull()
            .$defaultFn(() => []),
        description: text("description"),
        isOnSale: integer("is_on_sale", { mode: "boolean" })
            .default(true)
            .notNull(),

        skuCode: text("sku_code", { length: 50 }).notNull().unique(),

        reviewCount: integer("review_count").default(0).notNull(),
        ratingAvg: real("rating_avg").default(0.0).notNull(),
        favoriteCount: integer("favorite_count").default(0).notNull(),

        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        index("products_seller_idx").on(table.sellerId),
        index("products_category_idx").on(table.categoryCode),
        index("products_sku_idx").on(table.skuCode),
        index("products_status_idx").on(table.status)
    ]
);

// 2.6 상품 카테고리별 세부 속성 테이블
export const productFeedSnackAttributes = sqliteTable(
    "product_feed_snack_attributes",
    {
        productId: integer("product_id")
            .primaryKey()
            .references(() => products.id, { onDelete: "cascade" }),
        formulation: text("formulation")
            .$type<(typeof formulationValues)[number]>()
            .notNull(),
        growthStage:
            text("growth_stage").$type<(typeof growthStageValues)[number]>(),
        care: text("care", { mode: "json" })
            .$type<Array<(typeof careValues)[number]>>()
            .notNull()
            .$defaultFn(() => ["GE"]),
        ingredients: text("ingredients", { mode: "json" })
            .$type<Array<(typeof ingredientsValues)[number]>>()
            .notNull()
            .$defaultFn(() => []),
        volumeValue: real("volume_value").notNull(),
        volumeUnit: text("volume_unit")
            .$type<(typeof volumeUnitValues)[number]>()
            .notNull()
    }
);

export const productToyAttributes = sqliteTable(
    "product_toy_attributes",
    {
        productId: integer("product_id")
            .primaryKey()
            .references(() => products.id, { onDelete: "cascade" }),
        playType: text("play_type")
            .$type<(typeof playTypeValues)[number]>()
            .notNull(),
        material: text("material")
            .$type<(typeof materialValues)[number]>()
            .notNull(),
        size: text("size").$type<(typeof sizeValues)[number]>().notNull(),
        packageType: text("package_type")
            .$type<"1P" | "ST">()
            .default("1P")
            .notNull()
    },
    (table) => [index("toy_search_idx").on(table.playType, table.material)]
);

export const productClothingAttributes = sqliteTable(
    "product_clothing_attributes",
    {
        productId: integer("product_id")
            .primaryKey()
            .references(() => products.id, { onDelete: "cascade" }),
        style: text("style")
            .$type<(typeof clothingTypeValues)[number]>()
            .notNull(),
        color: text("color", { length: 2 }).notNull(),
        size: text("size").$type<(typeof sizeValues)[number]>().notNull(),
        season: text("season")
    },
    (table) => [
        index("clothing_search_idx").on(table.style, table.size, table.color)
    ]
);

export const productSuppliesAttributes = sqliteTable(
    "product_supplies_attributes",
    {
        productId: integer("product_id")
            .primaryKey()
            .references(() => products.id, { onDelete: "cascade" }),
        usage: text("usage")
            .$type<(typeof supplySubCategoryValues)[number]>()
            .notNull(),
        feature: text("feature"),
        volumeValue: real("volume_value"),
        volumeUnit: text("volume_unit")
            .$type<(typeof volumeUnitValues)[number]>()
            .notNull()
    },
    (table) => [index("supplies_search_idx").on(table.usage, table.feature)]
);

// 2.7 상품 리뷰 및 찜 테이블
export const productReviews = sqliteTable(
    "product_reviews",
    {
        id: integer("review_id").primaryKey({ autoIncrement: true }),
        productId: integer("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        authorId: text("author_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),
        rating: integer("rating").default(5).notNull(),
        content: text("content").notNull(),
        imageUrls: text("image_urls", { mode: "json" })
            .$type<string[]>()
            .$defaultFn(() => []),

        replyContent: text("reply_content"),
        repliedAt: integer("replied_at", { mode: "timestamp" }),

        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        index("reviews_product_idx").on(table.productId),
        index("reviews_author_idx").on(table.authorId)
    ]
);

export const productFavorites = sqliteTable(
    "product_favorites",
    {
        userId: text("user_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),
        productId: integer("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.productId] }),
        index("favorites_user_idx").on(table.userId),
        index("favorites_product_idx").on(table.productId)
    ]
);

// 2.8 숏폼 및 숏폼 댓글/좋아요 테이블
export const shorts = sqliteTable(
    "shorts",
    {
        id: integer("shorts_id").primaryKey({ autoIncrement: true }),
        creatorId: text("creator_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),
        productId: integer("product_id").references(() => products.id, {
            onDelete: "set null"
        }),
        findId: integer("find_id").references(() => finds.id, {
            onDelete: "set null"
        }),

        title: text("title").notNull(),
        description: text("description"),
        videoUrl: text("video_url").notNull(),
        thumbnailUrl: text("thumbnail_url").notNull(),
        duration: integer("duration").notNull(),
        aspectRatio: text("aspect_ratio").default("9:16").notNull(),

        category: text("category")
            .$type<(typeof shortsCategoryValues)[number]>()
            .notNull(),
        status: text("status")
            .$type<(typeof shortsStatusValues)[number]>()
            .default("PENDING")
            .notNull(),
        rejectionReason: text("rejection_reason"),

        youtubeUrl: text("youtube_url"),
        naverClipUrl: text("naver_clip_url"),
        affiliateUrl: text("affiliate_url"),

        views: integer("views").default(0).notNull(),
        likesCount: integer("likes_count").default(0).notNull(),
        commentsCount: integer("comments_count").default(0).notNull(),

        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        index("shorts_creator_idx").on(table.creatorId),
        index("shorts_good_idx").on(table.productId),
        index("shorts_find_idx").on(table.findId),
        index("shorts_status_idx").on(table.status),
        index("shorts_category_idx").on(table.category)
    ]
);

export const shortsComments = sqliteTable(
    "shorts_comments",
    {
        id: integer("comment_id").primaryKey({ autoIncrement: true }),
        shortsId: integer("shorts_id")
            .notNull()
            .references(() => shorts.id, { onDelete: "cascade" }),
        authorId: text("author_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),
        content: text("content").notNull(),
        isDeleted: integer("is_deleted", { mode: "boolean" })
            .default(false)
            .notNull(),
        parentId: integer("parent_id"),
        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull(),
        updatedAt: integer("updated_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        index("shorts_comments_shorts_idx").on(table.shortsId),
        index("shorts_comments_author_idx").on(table.authorId),
        index("shorts_comments_parent_idx").on(table.parentId),
        foreignKey({
            columns: [table.parentId],
            foreignColumns: [table.id],
            name: "shorts_comments_parent_id_fk"
        }).onDelete("cascade")
    ]
);

export const shortsLikes = sqliteTable(
    "shorts_likes",
    {
        userId: text("user_id")
            .notNull()
            .references(() => profiles.userId, { onDelete: "cascade" }),
        shortsId: integer("shorts_id")
            .notNull()
            .references(() => shorts.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp" })
            .$defaultFn(() => new Date())
            .notNull()
    },
    (table) => [
        primaryKey({ columns: [table.userId, table.shortsId] }),
        index("shorts_likes_user_idx").on(table.userId),
        index("shorts_likes_shorts_idx").on(table.shortsId)
    ]
);

// =========================================================================
// 3. Drizzle Relations 정의
// =========================================================================

export const profilesRelations = relations(profiles, ({ many }) => ({
    finds: many(finds),
    findComments: many(findComments),
    products: many(products),
    reviews: many(productReviews),
    favorites: many(productFavorites),
    shorts: many(shorts),
    shortsComments: many(shortsComments),
    shortsLikes: many(shortsLikes)
}));

export const breedsRelations = relations(breeds, ({ many }) => ({
    finds: many(finds)
}));

export const findsRelations = relations(finds, ({ one, many }) => ({
    author: one(profiles, {
        fields: [finds.userId],
        references: [profiles.userId]
    }),
    breed: one(breeds, {
        fields: [finds.breedId],
        references: [breeds.id]
    }),
    comments: many(findComments)
}));

export const findCommentsRelations = relations(
    findComments,
    ({ one, many }) => ({
        find: one(finds, {
            fields: [findComments.findId],
            references: [finds.id]
        }),
        author: one(profiles, {
            fields: [findComments.authorId],
            references: [profiles.userId]
        }),
        parent: one(findComments, {
            fields: [findComments.parentId],
            references: [findComments.id],
            relationName: "findCommentReplies"
        }),
        replies: many(findComments, {
            relationName: "findCommentReplies"
        })
    })
);

export const productsRelations = relations(products, ({ one, many }) => ({
    seller: one(profiles, {
        fields: [products.sellerId],
        references: [profiles.userId]
    }),
    feedSnackAttributes: one(productFeedSnackAttributes, {
        fields: [products.id],
        references: [productFeedSnackAttributes.productId]
    }),
    toyAttributes: one(productToyAttributes, {
        fields: [products.id],
        references: [productToyAttributes.productId]
    }),
    clothingAttributes: one(productClothingAttributes, {
        fields: [products.id],
        references: [productClothingAttributes.productId]
    }),
    suppliesAttributes: one(productSuppliesAttributes, {
        fields: [products.id],
        references: [productSuppliesAttributes.productId]
    }),
    reviews: many(productReviews),
    favorites: many(productFavorites),
    shorts: many(shorts)
}));

export const productFeedSnackAttributesRelations = relations(
    productFeedSnackAttributes,
    ({ one }) => ({
        product: one(products, {
            fields: [productFeedSnackAttributes.productId],
            references: [products.id]
        })
    })
);

export const productToyAttributesRelations = relations(
    productToyAttributes,
    ({ one }) => ({
        product: one(products, {
            fields: [productToyAttributes.productId],
            references: [products.id]
        })
    })
);

export const productClothingAttributesRelations = relations(
    productClothingAttributes,
    ({ one }) => ({
        product: one(products, {
            fields: [productClothingAttributes.productId],
            references: [products.id]
        })
    })
);

export const productSuppliesAttributesRelations = relations(
    productSuppliesAttributes,
    ({ one }) => ({
        product: one(products, {
            fields: [productSuppliesAttributes.productId],
            references: [products.id]
        })
    })
);

export const productReviewsRelations = relations(productReviews, ({ one }) => ({
    product: one(products, {
        fields: [productReviews.productId],
        references: [products.id]
    }),
    author: one(profiles, {
        fields: [productReviews.authorId],
        references: [profiles.userId]
    })
}));

export const productFavoritesRelations = relations(
    productFavorites,
    ({ one }) => ({
        product: one(products, {
            fields: [productFavorites.productId],
            references: [products.id]
        }),
        user: one(profiles, {
            fields: [productFavorites.userId],
            references: [profiles.userId]
        })
    })
);

export const shortsRelations = relations(shorts, ({ one, many }) => ({
    creator: one(profiles, {
        fields: [shorts.creatorId],
        references: [profiles.userId]
    }),
    product: one(products, {
        fields: [shorts.productId],
        references: [products.id]
    }),
    find: one(finds, {
        fields: [shorts.findId],
        references: [finds.id]
    }),
    comments: many(shortsComments),
    likedBy: many(shortsLikes)
}));

export const shortsCommentsRelations = relations(
    shortsComments,
    ({ one, many }) => ({
        shorts: one(shorts, {
            fields: [shortsComments.shortsId],
            references: [shorts.id]
        }),
        author: one(profiles, {
            fields: [shortsComments.authorId],
            references: [profiles.userId]
        }),
        parent: one(shortsComments, {
            fields: [shortsComments.parentId],
            references: [shortsComments.id],
            relationName: "shortsCommentReplies"
        }),
        replies: many(shortsComments, {
            relationName: "shortsCommentReplies"
        })
    })
);

export const shortsLikesRelations = relations(shortsLikes, ({ one }) => ({
    user: one(profiles, {
        fields: [shortsLikes.userId],
        references: [profiles.userId]
    }),
    shorts: one(shorts, {
        fields: [shortsLikes.shortsId],
        references: [shorts.id]
    })
}));

// =========================================================================
// 4. Zod 스키마 및 검증 객체 정의
// =========================================================================

export const insertProfileSchema = createInsertSchema(profiles, {
    userId: z.string().min(1, "사용자 ID가 필요합니다."),
    email: z.string().email("올바른 이메일 형식이 아닙니다."),
    username: z.string().min(1, "사용자 이름을 입력해주세요."),
    avatarUrl: z
        .string()
        .url("올바른 URL 형식이어야 합니다.")
        .optional()
        .nullable(),
    phoneNumber: z.string().optional().nullable(),
    roles: z.enum(userRoles).default("user"),
    isActive: z.boolean().default(true)
});
export const selectProfileSchema = createSelectSchema(profiles);

// breeds 입력 검증 (id 접두사 dog_, cat_ 유효성 검사 적용 가능)
export const insertBreedSchema = createInsertSchema(breeds, {
    id: z
        .string()
        .regex(
            /^(dog_|cat_)/,
            "품종 ID는 'dog_' 또는 'cat_' 접두어로 시작해야 합니다."
        ),
    name: z.string().min(1, "품종명을 입력해주세요.")
});
export const selectBreedSchema = createSelectSchema(breeds);

export const insertFindSchema = createInsertSchema(finds, {
    userId: z.string().min(1, "작성자 ID가 필요합니다."),
    breedId: z.string().optional().nullable(),
    findType: z.enum(findTypeValues),
    status: z.enum(findStatusValues).default("SEARCHING"),
    title: z.string().min(1, "제목을 입력해주세요."),
    description: z.string().min(1, "상황 설명을 입력해주세요."),
    eventTime: z.coerce.date().optional().nullable(),
    gender: z.enum(genderValues).default("U"),
    isNeutered: z.boolean().default(false),
    age: z.string().optional().nullable(),
    microchipId: z.string().optional().nullable(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
    address: z.string().optional().nullable(),
    locationDetail: z.string().optional().nullable(),
    geohash: z.string().optional().nullable(),
    imageUrls: z
        .array(z.string().url("올바른 URL 형식이어야 합니다."))
        .max(5, "이미지는 최대 5개까지 등록 가능합니다.")
        .default([]),
    videoUrl: z
        .string()
        .url("올바른 URL 형식이어야 합니다.")
        .nullable()
        .optional(),
    views: z.number().int().nonnegative().default(0)
});
export const selectFindSchema = createSelectSchema(finds);

export const insertFindCommentSchema = createInsertSchema(findComments, {
    findId: z.number().int().positive("올바른 게시글 ID가 필요합니다."),
    authorId: z.string().min(1, "작성자 ID가 필요합니다."),
    content: z
        .string()
        .min(1, "제보 내용을 입력해 주세요.")
        .max(1000, "제보 내용은 최대 1,000자까지 작성 가능합니다."),
    latitude: z.coerce.number().optional().nullable(),
    longitude: z.coerce.number().optional().nullable(),
    witnessTime: z.coerce.date().optional().nullable(),
    imageUrls: z
        .array(z.string().url("올바른 이미지 URL 형식이어야 합니다."))
        .max(3, "제보 이미지는 최대 3개까지 첨부할 수 있습니다.")
        .default([]),
    isPrivate: z.boolean().default(false),
    isDeleted: z.boolean().default(false),
    parentId: z.number().int().positive().optional().nullable()
});
export const selectFindCommentSchema = createSelectSchema(findComments);

export const insertShortsCommentSchema = createInsertSchema(shortsComments, {
    shortsId: z.number().int().positive("올바른 숏폼 ID가 필요합니다."),
    authorId: z.string().min(1, "작성자 ID가 필요합니다."),
    content: z
        .string()
        .min(1, "댓글 내용을 입력해 주세요.")
        .max(500, "댓글은 500자 이내여야 합니다."),
    isDeleted: z.boolean().default(false),
    parentId: z.number().int().positive().optional().nullable()
});
export const selectShortsCommentSchema = createSelectSchema(shortsComments);

export const PetTypeSchema = z.enum(petTypeValues);
export const CategoryCodeSchema = z.enum(categoryCodeValues);
export const ProductStatusSchema = z.enum(productStatusValues);
export const GrowthStageSchema = z.enum(growthStageValues);
export const FormulationSchema = z.enum(formulationValues);
export const CareSchema = z.enum(careValues);
export const IngredientsSchema = z.enum(ingredientsValues);
export const PlayTypeSchema = z.enum(playTypeValues);
export const MaterialSchema = z.enum(materialValues);
export const ClothingTypeSchema = z.enum(clothingTypeValues);
export const SizeSchema = z.enum(sizeValues);
export const SupplySubCategorySchema = z.enum(supplySubCategoryValues);
export const VolumeUnitSchema = z.enum(volumeUnitValues);

export type Profile = z.infer<typeof selectProfileSchema>;
export type NewProfile = z.infer<typeof insertProfileSchema>;

export type Breed = z.infer<typeof selectBreedSchema>;
export type NewBreed = z.infer<typeof insertBreedSchema>;

export type Find = z.infer<typeof selectFindSchema>;
export type NewFind = z.infer<typeof insertFindSchema>;

export type FindComment = z.infer<typeof selectFindCommentSchema>;
export type NewFindComment = z.infer<typeof insertFindCommentSchema>;

export type ShortsComment = z.infer<typeof selectShortsCommentSchema>;
export type NewShortsComment = z.infer<typeof insertShortsCommentSchema>;

export type PetType = z.infer<typeof PetTypeSchema>;
export type CategoryCode = z.infer<typeof CategoryCodeSchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export type GrowthStage = z.infer<typeof GrowthStageSchema>;
export type Formulation = z.infer<typeof FormulationSchema>;
export type Care = z.infer<typeof CareSchema>;
export type Ingredients = z.infer<typeof IngredientsSchema>;
export type PlayType = z.infer<typeof PlayTypeSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type ClothingType = z.infer<typeof ClothingTypeSchema>;
export type Size = z.infer<typeof SizeSchema>;
export type SupplySubCategory = z.infer<typeof SupplySubCategorySchema>;
export type VolumeUnit = z.infer<typeof VolumeUnitSchema>;
