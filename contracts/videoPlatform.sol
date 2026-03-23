// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VideoPlatform {
    uint public videoCount = 0;

    struct Video {
        uint id;
        string hash;
        string title;
        address author;
        uint createdAt;
        uint views;
        uint likes;
        uint commentCount;
    }

    struct Comment {
        address author;
        string text;
        uint createdAt;
    }

    mapping(uint => Video) public videos;
    mapping(uint => mapping(uint => Comment)) private videoComments;
    mapping(uint => mapping(address => bool)) public hasLiked;

    function uploadVideo(string memory _hash, string memory _title) public {
        require(bytes(_hash).length > 0, "Video hash required");
        require(bytes(_title).length > 0, "Title required");
        require(msg.sender != address(0), "Invalid author");

        videoCount++;

        videos[videoCount] = Video(
            videoCount,
            _hash,
            _title,
            msg.sender,
            block.timestamp,
            0,
            0,
            0
        );
    }

    function viewVideo(uint _id) public {
        require(_id > 0 && _id <= videoCount, "Video does not exist");

        videos[_id].views++;
    }

    function toggleLike(uint _id) public {
        require(_id > 0 && _id <= videoCount, "Video does not exist");

        if (hasLiked[_id][msg.sender]) {
            hasLiked[_id][msg.sender] = false;
            videos[_id].likes--;
        } else {
            hasLiked[_id][msg.sender] = true;
            videos[_id].likes++;
        }
    }

    function addComment(uint _id, string memory _text) public {
        require(_id > 0 && _id <= videoCount, "Video does not exist");
        require(bytes(_text).length > 0, "Comment required");

        uint nextCommentId = videos[_id].commentCount + 1;

        videoComments[_id][nextCommentId] = Comment(
            msg.sender,
            _text,
            block.timestamp
        );

        videos[_id].commentCount = nextCommentId;
    }

    function getComment(uint _videoId, uint _commentId)
        public
        view
        returns (address, string memory, uint)
    {
        require(_videoId > 0 && _videoId <= videoCount, "Video does not exist");
        require(
            _commentId > 0 && _commentId <= videos[_videoId].commentCount,
            "Comment does not exist"
        );

        Comment memory comment = videoComments[_videoId][_commentId];
        return (comment.author, comment.text, comment.createdAt);
    }
}
