"use strict";
// 九大入試オープンの解答例：提供された各年度の採点資料に掲載の著作者作成例。
// 原題・問題文・図表は収録していない。年度は入試対策年度（模試実施は前年11月）。
const OPEN_MODELS = {
  "open2023-4": [
    {
      "label": "解答例①",
      "words": 100,
      "text": "Clearly, SVOD services have several benefits. First, their users pay a fixed amount of money per month, so they can watch many movies at no additional cost on the services. Second, SVOD services are available through multiple platforms. You can enjoy a wide variety of videos on a big-screen TV with your family, on your smartphone outside your home, or on tablet PCs with friends, which enables you to spend your spare time flexibly. Lastly, more and more movies have recently been released on SVOD services alone, and some of them have received good ratings and even won prestigious awards."
    },
    {
      "label": "解答例②",
      "words": 100,
      "text": "There are some drawbacks in using SVOD services. First of all, the number of movies on the services is limited. Generally, you still need to go to theaters to see new movies and some older ones are unavailable online. Each service usually offers their original content and it would cost too much to subscribe to them all. In addition, SVOD services “steal” your time. When you have watched a video, its sequels or similar videos are recommended on the screen and you will end up watching them. As a result, you may spend little time with your family or friends."
    }
  ],
  "open2023-5": [
    {
      "label": "解答例",
      "words": 76,
      "text": "Overall, the sales of the Japanese comics market increased from 2014 to 2021. From 2014 to 2018, the sales remained almost stable, but after that, they greatly increased from 441 billion yen to 676 billion yen. The sales of digital comics were consistently on the increase; they were over four times as large in 2021 as in 2014. On the other hand, paper-based comics decreased their sales from 2014 to 2019 before showing a slight increase."
    }
  ],
  "open2024-4": [
    {
      "label": "解答例",
      "words": 100,
      "text": "Drones can be used to make it easier to transport various things. More and more people are ordering via the Internet and receiving things by home delivery. However, people in rural areas, especially those in the mountains, have trouble having their orders delivered. Drones can be used to deliver them rapidly. Using drones for transportation can also help disaster victims. In natural disasters, truck delivery is often unavailable. In such cases, drones can carry relief goods, including medical supplies, to victims quickly and safely. More people can be saved if we make better use of drones in case of emergency."
    },
    {
      "label": "別バージョン",
      "words": 102,
      "text": "Drones can be used to carry drugs and organs. These days, many people consult doctors over the phone or on the Internet and receive prescription drugs by mail. However, patients in serious condition sometimes need to take medicine as soon as possible. Drones can be used to deliver it. The medical use of drones can also be good news for patients waiting for an organ transplant. Drones can deliver organs from donors to patients quickly and safely, enabling more organs to be transplanted in the future. More patients can be saved if we make more use of drones in the medical field."
    }
  ],
  "open2024-5": [
    {
      "label": "解答例",
      "words": null,
      "text": "(A) Annual precipitation is heavier in Joetsu City than in Naha City. In addition, the peak months are different. In Naha City, the monthly precipitation is heaviest in June and September, when it reaches around 280mm. On the other hand, in Joetsu City, it is heaviest in December, when it amounts to 475.5mm.\n(B) In Naha City, it rains a lot in May and June because of the rainy season, and in August and September due to typhoons. Meanwhile, Joetsu City, located in the Hokuriku district, has an extremely heavy snowfall in winter."
    }
  ],
  "open2025-4": [
    {
      "label": "解答例",
      "words": 100,
      "text": "In recent years, Futōkō has been viewed negatively in Japan. But by addressing this matter, we can gain a different perspective. First, students should not all be treated in the same way. Rather, they should be regarded as individuals with their own unique personalities. Second, schools should be more flexible and should not be bound by strict rules. This will help to foster an environment in which Japanese people place more value on the individuality of children. As the educational system becomes more tolerant of diversity, so will Japanese society. In this way, we can create a more inclusive society."
    },
    {
      "label": "別バージョン①",
      "words": 100,
      "text": "The increasing number of children refusing to attend school in Japan can have two positive effects on education in Japan. First, this trend can create more supportive and individualized learning experiences. For example, it can lead to the development of specialized learning programs for those children, enabling teaching adapted to each student. Second, it can prompt essential reforms in teachers’ working conditions through the employment of more staff, reducing the burden on teachers, and improving their ability to support students effectively. These effects can improve the Japanese educational environment, enhancing the overall quality of education for both students and teachers."
    },
    {
      "label": "別バージョン②",
      "words": 101,
      "text": "Futōkō is usually viewed negatively, but this issue can lead to two positive changes for Japanese families. Firstly, this trend can encourage parents to better understand and support their children who refuse to go to school. By listening to their children’s feelings, they can foster stronger family bonds. Secondly, it can offer these children the opportunity to grow by participating in volunteer or community activities under circumstances different from those of traditional schools. Such experiences can help them gain confidence, and broaden their horizons, and learn to accept responsibility. These changes can result in more supportive family relationships and well-rounded children."
    }
  ],
  "open2025-5": [
    {
      "label": "解答例",
      "words": 80,
      "text": "I would choose Plan B. First, visiting ancient landmarks and traditional buildings will offer a unique cultural experience. This will give my friend a deeper understanding of Japan’s rich history and traditions. Second, enjoying the natural landscape and tasty local food will provide us with a peaceful and memorable experience, away from the hustle and bustle of city life. This combination of culture, nature, and local cuisine is sure to be not only relaxing but also a truly unforgettable trip."
    }
  ],
  "open2026-4": [
    {
      "label": "解答例①",
      "words": 100,
      "text": "I would like to choose Program A. First, it is a small class. I would be able to ask questions more easily and stay focused on the program. Such a serious atmosphere would help me improve. Second, the teacher is a native English speaker. Learning English in English would be helpful and give me a chance to hear natural English. Moreover, writing by hand helps students better understand and remember things without the distraction of electronic devices. Although Program A is more expensive than Program B, it would be more effective and worth the money for improving my English skills."
    },
    {
      "label": "解答例②",
      "words": 100,
      "text": "I would choose Program B. One reason is that the classes are taught in Japanese. Many Japanese university students, including me, find it easier to understand things in their native language. Another reason is the fee. Program B is less expensive, which would enable me to join the program without financial stress. Also, using devices like tablets and PCs in class would help me develop useful skills. This would be a good chance to get used to digital technology, which is important for research, presentations, and future work. I believe that Program B has more advantages for students like me."
    }
  ],
  "open2026-5": [
    {
      "label": "解答例①",
      "words": 80,
      "text": "If the number of public libraries decreases, students may become unable to study or do research in a quiet place with many materials. Young children may also have fewer chances to read books, which can prevent them from building good reading habits. Furthermore, without libraries, only people who can afford to buy books or use online services would be able to access information easily. This could increase inequality in education and make it harder for some people to learn freely."
    },
    {
      "label": "解答例②",
      "words": 80,
      "text": "If public libraries disappear, children and elderly people may lose access to places where they can feel safe and relax. Libraries also hold local events such as reading workshops and volunteer meetings, so losing them can weaken community ties severely. In addition, libraries serve as sources of public service information. In the event of an emergency or natural disaster, some libraries are used as shelters. Without them, local communities may lose both important ways to stay informed and disaster facilities."
    }
  ],
  "open2027-4": [
    {
      "label": "解答例",
      "words": 100,
      "text": "Above all, medical doctors need the ability to diagnose patients’ conditions correctly based on their symptoms and the results of medical tests. They should be willing to refer patients to specialists when necessary. Second, they need good communication skills. They should listen sympathetically and share information with patients, their families, and medical staff, so that they trust one another and treatment can go smoothly. Finally, doctors need to maintain their stamina. Although their working environments have improved in recent years, they still need to stay healthy in order to be able to work for long periods and support their patients."
    }
  ],
  "open2027-5": [
    {
      "label": "解答例",
      "words": 80,
      "text": "In 2005, 61% of students at Kawai High School studied English using paper dictionaries, while those who used digital devices accounted for 10%. By 2025, this relationship had almost reversed. Paper dictionary use decreased dramatically to 18%, whereas digital device use increased sharply to 58%. On the other hand, electronic dictionary use changed only slightly, decreasing from 29% to 24%. Overall, students came to rely far less on paper dictionaries and much more on digital devices over the twenty-year period."
    }
  ]
};
