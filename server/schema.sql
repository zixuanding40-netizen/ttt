IF DB_ID(N'CineList') IS NULL
BEGIN
    CREATE DATABASE CineList;
END
GO

USE CineList;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        username NVARCHAR(80) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        display_name NVARCHAR(80) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_Users PRIMARY KEY (id),
        CONSTRAINT UQ_Users_Username UNIQUE (username)
    );
END
GO

IF OBJECT_ID(N'dbo.UserAppStates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserAppStates (
        user_id UNIQUEIDENTIFIER NOT NULL,
        state_json NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserAppStates PRIMARY KEY (user_id),
        CONSTRAINT FK_UserAppStates_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID(N'dbo.DiscussionComments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DiscussionComments (
        id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        movie_id NVARCHAR(80) NOT NULL,
        parent_id UNIQUEIDENTIFIER NULL,
        author NVARCHAR(80) NOT NULL,
        text NVARCHAR(1000) NOT NULL,
        likes INT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_DiscussionComments PRIMARY KEY (id),
        CONSTRAINT FK_DiscussionComments_Parent FOREIGN KEY (parent_id) REFERENCES dbo.DiscussionComments(id)
    );

    CREATE INDEX IX_DiscussionComments_Movie ON dbo.DiscussionComments(movie_id, likes DESC, created_at DESC);
END
GO
